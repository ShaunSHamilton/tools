use mongodb::{
    Collection, Database,
    bson::{DateTime, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub session_id: String,
    pub expires_at: DateTime,
}

impl Session {
    fn collection(db: &Database) -> Collection<Session> {
        db.collection("session")
    }

    pub async fn find_by_session_id(
        db: &Database,
        session_id: &str,
    ) -> mongodb::error::Result<Option<Session>> {
        Self::collection(db)
            .find_one(doc! { "session_id": session_id })
            .await
    }

    pub async fn create(
        db: &Database,
        user_id: ObjectId,
        session_id: String,
        expires_at: DateTime,
    ) -> mongodb::error::Result<Session> {
        let session = Session {
            id: ObjectId::new(),
            user_id,
            session_id,
            expires_at,
        };
        Self::collection(db).insert_one(&session).await?;
        Ok(session)
    }

    pub async fn delete_by_session_id(
        db: &Database,
        session_id: &str,
    ) -> mongodb::error::Result<()> {
        Self::collection(db)
            .delete_one(doc! { "session_id": session_id })
            .await?;
        Ok(())
    }
}
