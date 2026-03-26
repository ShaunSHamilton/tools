use std::sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
};

use axum::{
    extract::{State, ws::{Message, WebSocket, WebSocketUpgrade}},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use axum_extra::extract::PrivateCookieJar;
use dashmap::DashMap;
use futures::{SinkExt, StreamExt};
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};

use crate::team_board::{app::AppState, models::{notification::{Notification, NotificationPayload}, org::OrgMember, session::Session, user::User}};

// ── Changelog ─────────────────────────────────────────────────────────────────

const CHANGELOG: &str = include_str!("../../CHANGELOG.md");

/// Extracts the release notes for `version` from a Keep-a-Changelog document.
/// Returns the text between the matching version header and the next version
/// header (or end of file), trimmed.
fn extract_version_notes(changelog: &str, version: &str) -> String {
    let header = format!("## [{version}]");
    let mut in_section = false;
    let mut lines: Vec<&str> = Vec::new();

    for line in changelog.lines() {
        if in_section {
            // Stop at the next `## [` section header
            if line.starts_with("## [") {
                break;
            }
            lines.push(line);
        } else if line.starts_with(&header) {
            in_section = true;
        }
    }

    lines.join("\n").trim().to_string()
}

// ── Presence state ────────────────────────────────────────────────────────────

/// Per-connection entry: the owning user's id + the outbound sender.
struct ConnEntry {
    user_id: ObjectId,
    tx: UnboundedSender<Message>,
}

/// Manages active WebSocket connections, keyed by org_id → conn_id → entry.
pub struct OrgPresence {
    connections: DashMap<String, DashMap<u64, ConnEntry>>,
    next_id: AtomicU64,
}

impl OrgPresence {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            connections: DashMap::new(),
            next_id: AtomicU64::new(0),
        })
    }

    fn alloc_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }

    fn register(&self, org_id: &str, conn_id: u64, user_id: ObjectId, tx: UnboundedSender<Message>) {
        self.connections
            .entry(org_id.to_string())
            .or_default()
            .insert(conn_id, ConnEntry { user_id, tx });
    }

    fn remove_conn(&self, org_id: &str, conn_id: u64) {
        if let Some(org_conns) = self.connections.get(org_id) {
            org_conns.remove(&conn_id);
        }
    }

    /// Send a JSON string to all connections in `org_id`, optionally skipping one.
    pub fn broadcast_except(&self, org_id: &str, msg: &str, skip: Option<u64>) {
        let Some(org_conns) = self.connections.get(org_id) else {
            return;
        };
        let dead: Vec<u64> = org_conns
            .iter()
            .filter(|e| skip.is_none_or(|s| *e.key() != s))
            .filter_map(|e| {
                e.value()
                    .tx
                    .send(Message::Text(msg.to_owned().into()))
                    .err()
                    .map(|_| *e.key())
            })
            .collect();
        for id in dead {
            org_conns.remove(&id);
        }
    }

    pub fn broadcast(&self, org_id: &str, msg: &str) {
        self.broadcast_except(org_id, msg, None);
    }

    /// Collect all (conn_id, user_id) pairs in an org except the given conn_id.
    fn recipients_except(&self, org_id: &str, skip: u64) -> Vec<(u64, ObjectId)> {
        let Some(org_conns) = self.connections.get(org_id) else {
            return vec![];
        };
        org_conns
            .iter()
            .filter(|e| *e.key() != skip)
            .map(|e| (*e.key(), e.value().user_id))
            .collect()
    }

    /// Send `msg` to a specific connection by conn_id. Returns true if sent, false if dead.
    fn send_to(&self, org_id: &str, conn_id: u64, msg: &str) -> bool {
        let Some(org_conns) = self.connections.get(org_id) else {
            return false;
        };
        let Some(entry) = org_conns.get(&conn_id) else {
            return false;
        };
        if entry.tx.send(Message::Text(msg.to_owned().into())).is_err() {
            drop(entry);
            org_conns.remove(&conn_id);
            return false;
        }
        true
    }
}

// ── Handler ───────────────────────────────────────────────────────────────────

/// `GET /ws` — upgrades to WebSocket.
/// Auth via the `sid` session cookie (sent automatically by the browser).
/// The client's first message must be `{ "type": "join", "org_id": "..." }`.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    jar: PrivateCookieJar,
) -> Response {
    let session_id = match jar.get("sid").map(|c| c.value().to_owned()) {
        Some(sid) => sid,
        None => return (StatusCode::UNAUTHORIZED, "missing session").into_response(),
    };

    let user_id = match Session::find_by_session_id(&state.db, &session_id).await {
        Ok(Some(s)) => s.user_id,
        Ok(None) => return (StatusCode::UNAUTHORIZED, "invalid session").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "session lookup failed for ws");
            return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response();
        }
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, user_id))
}

async fn handle_socket(socket: WebSocket, state: AppState, user_id: ObjectId) {
    let (mut ws_tx, mut ws_rx) = socket.split();

    // ── 1. Await Join message (10-second timeout) ─────────────────────────────
    let org_id = {
        let first = tokio::time::timeout(std::time::Duration::from_secs(10), ws_rx.next()).await;

        let text = match first {
            Ok(Some(Ok(Message::Text(t)))) => t.to_string(),
            _ => return,
        };

        #[derive(Deserialize)]
        #[serde(tag = "type", rename_all = "snake_case")]
        enum JoinMsg {
            Join { org_id: String },
        }

        match serde_json::from_str::<JoinMsg>(&text) {
            Ok(JoinMsg::Join { org_id }) => org_id,
            _ => return,
        }
    };

    // ── 2. Validate org membership ────────────────────────────────────────────
    let org_oid = match org_id.parse::<ObjectId>() {
        Ok(oid) => oid,
        Err(_) => return,
    };
    let is_member = OrgMember::find(&state.db, &org_oid, &user_id)
        .await
        .ok()
        .flatten()
        .is_some();
    if !is_member {
        return;
    }

    // ── 3. Register connection ────────────────────────────────────────────────
    let conn_id = state.presence.alloc_id();
    let (tx, mut rx) = unbounded_channel::<Message>();
    // Keep a clone of the sender before moving tx into the presence map,
    // so we can target this specific connection for the release notification.
    let tx_for_notif = tx.clone();
    state.presence.register(&org_id, conn_id, user_id, tx);

    tracing::debug!(
        conn_id,
        org_id = %org_id,
        user_id = %user_id,
        "ws connected"
    );

    // ── 3b. Send AppRelease notification if not already sent for this version ─
    {
        let current_version = env!("CARGO_PKG_VERSION");
        let db = state.db.clone();
        let notes = extract_version_notes(CHANGELOG, current_version);
        let version_str = current_version.to_string();

        tokio::spawn(async move {
            // Check if we already have an AppRelease notification for this version
            let collection = db.collection::<mongodb::bson::Document>("Notification");
            let exists = collection
                .count_documents(doc! {
                    "user_id": &user_id,
                    "payload.type": "app_release",
                    "payload.version": &version_str,
                })
                .await;

            match exists {
                Ok(0) => {
                    // Create the notification
                    match Notification::create(
                        &db,
                        user_id,
                        NotificationPayload::AppRelease {
                            version: version_str,
                            notes,
                        },
                    )
                    .await
                    {
                        Ok(_) => {
                            let msg = serde_json::json!({ "type": "notification" }).to_string();
                            let _ = tx_for_notif.send(Message::Text(msg.into()));
                        }
                        Err(e) => {
                            tracing::error!(error = %e, "failed to create AppRelease notification");
                        }
                    }
                }
                Ok(_) => {
                    // Already notified for this version — nothing to do
                }
                Err(e) => {
                    tracing::error!(error = %e, "failed to query AppRelease notifications");
                }
            }
        });
    }

    // Spawn a task to forward outbound messages from the channel to the WS sink
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_tx.send(msg).await.is_err() {
                break;
            }
        }
    });

    // ── 4. Receive loop ───────────────────────────────────────────────────────
    #[derive(Deserialize)]
    #[serde(tag = "type", rename_all = "snake_case")]
    enum ClientMsg {
        CursorMove { x: f32, y: f32, board_id: String },
    }

    loop {
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(ClientMsg::CursorMove { x, y, board_id }) =
                            serde_json::from_str::<ClientMsg>(&text)
                        {
                            // Check if the sender has opted out of sharing their cursor
                            let sender_shows = match User::find_by_id(&state.db, &user_id).await {
                                Ok(Some(u)) => u.show_live_cursors.unwrap_or(true),
                                _ => true,
                            };
                            if !sender_shows {
                                // Sender opted out — don't broadcast their cursor at all
                                continue;
                            }

                            let evt = json!({
                                "type": "cursor_moved",
                                "payload": {
                                    "user_id": user_id.to_hex(),
                                    "x": x,
                                    "y": y,
                                    "board_id": board_id,
                                }
                            })
                            .to_string();

                            // Broadcast only to recipients who have live cursors enabled
                            let recipients = state.presence.recipients_except(&org_id, conn_id);
                            for (rcpt_conn_id, rcpt_user_id) in recipients {
                                let rcpt_shows = match User::find_by_id(&state.db, &rcpt_user_id).await {
                                    Ok(Some(u)) => u.show_live_cursors.unwrap_or(true),
                                    _ => true,
                                };
                                if rcpt_shows {
                                    state.presence.send_to(&org_id, rcpt_conn_id, &evt);
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Ping(bytes))) => {
                        // axum handles pong automatically, but send manually to be safe
                        state.presence.broadcast_except(&org_id, "", None); // noop
                        let _ = bytes; // suppress warning
                    }
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    _ => {}
                }
            }
            // send_task ended (WS sink closed)
            _ = &mut send_task => break,
        }
    }

    // ── 5. Cleanup ────────────────────────────────────────────────────────────
    send_task.abort();
    state.presence.remove_conn(&org_id, conn_id);

    let leave = json!({
        "type": "user_left",
        "payload": { "user_id": user_id.to_hex() }
    })
    .to_string();
    state.presence.broadcast(&org_id, &leave);

    tracing::debug!(conn_id, "ws disconnected");
}
