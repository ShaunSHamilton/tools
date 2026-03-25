use futures::TryStreamExt;
use mongodb::{
    Collection, Database,
    bson::{DateTime, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvitationStatus {
    Pending,
    Accepted,
    Declined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invitation {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub org_id: ObjectId,
    pub invited_email: String,
    pub invited_by: ObjectId,
    pub status: InvitationStatus,
    pub created_at: DateTime,
}

impl Invitation {
    fn collection(db: &Database) -> Collection<Invitation> {
        db.collection("Invitation")
    }

    pub async fn create(
        db: &Database,
        org_id: ObjectId,
        invited_email: String,
        invited_by: ObjectId,
    ) -> mongodb::error::Result<Invitation> {
        let inv = Invitation {
            id: ObjectId::new(),
            org_id,
            invited_email,
            invited_by,
            status: InvitationStatus::Pending,
            created_at: DateTime::now(),
        };
        Self::collection(db).insert_one(&inv).await?;
        Ok(inv)
    }

    pub async fn find_by_id(
        db: &Database,
        id: &ObjectId,
    ) -> mongodb::error::Result<Option<Invitation>> {
        Self::collection(db).find_one(doc! { "_id": id }).await
    }

    pub async fn find_pending(
        db: &Database,
        org_id: &ObjectId,
        email: &str,
    ) -> mongodb::error::Result<Option<Invitation>> {
        Self::collection(db)
            .find_one(doc! {
                "org_id": org_id,
                "invited_email": email,
                "status": "pending",
            })
            .await
    }

    /// All pending invitations for an org (for the admin member page).
    pub async fn find_pending_for_org(
        db: &Database,
        org_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<Invitation>> {
        Self::collection(db)
            .find(doc! { "org_id": org_id, "status": "pending" })
            .sort(doc! { "created_at": 1 })
            .await?
            .try_collect()
            .await
    }

    pub async fn delete(db: &Database, id: &ObjectId) -> mongodb::error::Result<bool> {
        let r = Self::collection(db).delete_one(doc! { "_id": id }).await?;
        Ok(r.deleted_count > 0)
    }

    pub async fn set_status(
        db: &Database,
        id: &ObjectId,
        status: InvitationStatus,
    ) -> mongodb::error::Result<()> {
        let status_str = match status {
            InvitationStatus::Pending => "pending",
            InvitationStatus::Accepted => "accepted",
            InvitationStatus::Declined => "declined",
        };
        Self::collection(db)
            .update_one(
                doc! { "_id": id },
                doc! { "$set": { "status": status_str } },
            )
            .await?;
        Ok(())
    }
}
