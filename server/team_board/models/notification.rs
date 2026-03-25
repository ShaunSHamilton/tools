use futures::TryStreamExt;
use mongodb::{
    Collection, Database,
    bson::{DateTime, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NotificationPayload {
    OrgInvite {
        invitation_id: ObjectId,
        org_id: ObjectId,
        org_name: String,
        invited_by: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub read: bool,
    pub payload: NotificationPayload,
    pub created_at: DateTime,
}

impl Notification {
    fn collection(db: &Database) -> Collection<Notification> {
        db.collection("Notification")
    }

    pub async fn create(
        db: &Database,
        user_id: ObjectId,
        payload: NotificationPayload,
    ) -> mongodb::error::Result<Notification> {
        let n = Notification {
            id: ObjectId::new(),
            user_id,
            read: false,
            payload,
            created_at: DateTime::now(),
        };
        Self::collection(db).insert_one(&n).await?;
        Ok(n)
    }

    /// Returns notifications as JSON values so ObjectIds serialize to hex strings.
    pub async fn find_for_user(
        db: &Database,
        user_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<serde_json::Value>> {
        let notifications: Vec<Notification> = Self::collection(db)
            .find(doc! { "user_id": user_id })
            .sort(doc! { "created_at": -1 })
            .await?
            .try_collect()
            .await?;

        let result = notifications
            .iter()
            .map(|n| {
                let payload = match &n.payload {
                    NotificationPayload::OrgInvite {
                        invitation_id,
                        org_id,
                        org_name,
                        invited_by,
                    } => json!({
                        "type": "org_invite",
                        "invitation_id": invitation_id.to_hex(),
                        "org_id": org_id.to_hex(),
                        "org_name": org_name,
                        "invited_by": invited_by,
                    }),
                };
                json!({
                    "id": n.id.to_hex(),
                    "read": n.read,
                    "created_at": n.created_at.to_string(),
                    "payload": payload,
                })
            })
            .collect();

        Ok(result)
    }

    pub async fn mark_read(
        db: &Database,
        id: &ObjectId,
        user_id: &ObjectId,
    ) -> mongodb::error::Result<()> {
        Self::collection(db)
            .update_one(
                doc! { "_id": id, "user_id": user_id },
                doc! { "$set": { "read": true } },
            )
            .await?;
        Ok(())
    }

    /// Used on login: create notifications for any pending invitations matching the user's email.
    pub async fn backfill_pending_invites(
        db: &Database,
        user_id: ObjectId,
        email: &str,
    ) -> mongodb::error::Result<()> {
        use futures::TryStreamExt;

        let invitations: Vec<crate::team_board::models::invitation::Invitation> = db
            .collection::<crate::team_board::models::invitation::Invitation>("invitations")
            .find(doc! { "invited_email": email, "status": "pending" })
            .await?
            .try_collect()
            .await?;

        for inv in invitations {
            // Only create if no notification already exists for this invitation
            let exists = Self::collection(db)
                .count_documents(doc! {
                    "user_id": &user_id,
                    "payload.invitation_id": &inv.id,
                })
                .await?;

            if exists == 0 {
                let org: Option<crate::team_board::models::org::Org> = db
                    .collection::<crate::team_board::models::org::Org>("organisations")
                    .find_one(doc! { "_id": &inv.org_id })
                    .await?;

                if let Some(org) = org {
                    let inviter: Option<crate::team_board::models::user::User> = db
                        .collection::<crate::team_board::models::user::User>("users")
                        .find_one(doc! { "_id": &inv.invited_by })
                        .await?;

                    let invited_by = inviter
                        .map(|u| u.name)
                        .unwrap_or_else(|| "someone".to_string());

                    Self::create(
                        db,
                        user_id,
                        NotificationPayload::OrgInvite {
                            invitation_id: inv.id,
                            org_id: org.id,
                            org_name: org.name,
                            invited_by,
                        },
                    )
                    .await?;
                }
            }
        }

        Ok(())
    }
}
