use axum::{
    extract::{FromRef, FromRequestParts, Path, State},
    http::request::Parts,
};
use axum_extra::extract::PrivateCookieJar;
use mongodb::bson::doc;

use axum::extract::ws::WebSocketUpgrade;
use axum::response::IntoResponse;
use http::StatusCode;
use tracing::{error, info, warn};

use crate::exam_creator::{
    database::prisma,
    errors::Error,
    routes::websocket::handle_users_ws,
    state::{Activity, ServerState, User},
};
use crate::team_board::models::session::Session;
use crate::team_board::models::user::User as TeamBoardUser;

impl<S> FromRequestParts<S> for prisma::ExamCreatorUser
where
    S: Send + Sync,
    ServerState: FromRef<S>,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let state = ServerState::from_ref(state);

        let cookiejar: PrivateCookieJar = PrivateCookieJar::from_request_parts(parts, &state)
            .await
            .map_err(|e| {
                error!("cookie jar could not be constructed: {e:?}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "unable to handle cookies",
                )
            })?;

        let Some(cookie) = cookiejar.get("sid").map(|cookie| cookie.value().to_owned()) else {
            warn!("no sid in jar");
            return Err((StatusCode::UNAUTHORIZED, "no sid in jar"));
        };

        // Look up the session in team_board's MongoDB
        let session = Session::find_by_session_id(&state.tb_db, &cookie)
            .await
            .map_err(|e| {
                error!("db session find op failed: {e:?}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "db session find op failed",
                )
            })?
            .ok_or((StatusCode::UNAUTHORIZED, "no existing session"))?;

        // Fetch the user from team_board's users collection
        let tb_user = state
            .tb_db
            .collection::<TeamBoardUser>("users")
            .find_one(doc! {"_id": session.user_id})
            .await
            .map_err(|e| {
                error!("db user find op failed: {e:?}");
                (StatusCode::INTERNAL_SERVER_ERROR, "db user find op failed")
            })?
            .ok_or((StatusCode::UNAUTHORIZED, "no user account"))?;

        // Map team_board user to ExamCreatorUser (compatible structure)
        let user = prisma::ExamCreatorUser {
            id: session.user_id,
            name: tb_user.name.clone(),
            email: tb_user.email.clone(),
            github_id: tb_user.github_id,
            picture: tb_user.picture.clone(),
            settings: Default::default(),
            version: 2,
        };

        let client_sync = &mut state.client_sync.lock().unwrap();
        if let Some(u) = client_sync.users.iter_mut().find(|u| u.email == user.email) {
            u.activity.last_active = chrono::Utc::now().timestamp_millis() as usize;
        } else {
            let name = user.name.clone();
            let email = user.email.clone();
            let picture = user.picture.clone().unwrap_or_default();
            let activity = Activity {
                page: "/".to_string(),
                last_active: chrono::Utc::now().timestamp_millis() as usize,
            };
            let settings = user.settings.clone();
            client_sync.users.push(User {
                name,
                email,
                picture,
                activity,
                settings,
            });
        }

        Ok(user)
    }
}

pub async fn ws_handler_exam(
    _ws: WebSocketUpgrade,
    Path(exam_id): Path<String>,
    State(_state): State<ServerState>,
) -> impl IntoResponse {
    info!("WebSocket connection request for exam_id: {}", exam_id);
}

pub async fn ws_handler_users(
    ws: WebSocketUpgrade,
    jar: PrivateCookieJar,
    State(state): State<ServerState>,
) -> Result<impl IntoResponse, Error> {
    info!("WebSocket connection request for users");

    let cookie = jar
        .get("sid")
        .map(|c| c.value().to_owned())
        .ok_or(Error::Server(
            StatusCode::UNAUTHORIZED,
            "no sid cookie".to_string(),
        ))?;

    let session = Session::find_by_session_id(&state.tb_db, &cookie)
        .await?
        .ok_or(Error::Server(
            StatusCode::UNAUTHORIZED,
            "session not found".to_string(),
        ))?;

    let user = state
        .tb_db
        .collection::<TeamBoardUser>("users")
        .find_one(doc! {"_id": session.user_id})
        .await?
        .ok_or(Error::Server(
            StatusCode::UNAUTHORIZED,
            format!("user not found: {}", session.user_id),
        ))?;

    // Map to ExamCreatorUser for handle_users_ws
    let ec_user = prisma::ExamCreatorUser {
        id: session.user_id,
        name: user.name,
        email: user.email,
        github_id: user.github_id,
        picture: user.picture,
        settings: Default::default(),
        version: 2,
    };

    let upgrade_res = ws.on_upgrade(move |socket| handle_users_ws(socket, ec_user, state));
    Ok(upgrade_res)
}
