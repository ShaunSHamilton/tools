use futures::TryStreamExt;
use mongodb::{
    Collection, Database,
    bson::{DateTime, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use super::task::{
    first_position, position_after, position_before, position_between,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub task_id: ObjectId,
    pub org_id: ObjectId,
    pub created_by: ObjectId,
    pub content: String,
    #[serde(default)]
    pub votes: Vec<ObjectId>,
    pub dismissed: bool,
    pub position: String,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

impl Suggestion {
    fn collection(db: &Database) -> Collection<Suggestion> {
        db.collection("suggestions")
    }

    pub async fn create(
        db: &Database,
        task_id: ObjectId,
        org_id: ObjectId,
        created_by: ObjectId,
        content: String,
    ) -> mongodb::error::Result<Suggestion> {
        let last = Self::collection(db)
            .find_one(doc! { "task_id": task_id })
            .sort(doc! { "position": -1 })
            .await?;

        let position = match last {
            Some(s) => position_after(&s.position),
            None => first_position(),
        };

        let now = DateTime::now();
        let suggestion = Suggestion {
            id: ObjectId::new(),
            task_id,
            org_id,
            created_by,
            content,
            votes: Vec::new(),
            dismissed: false,
            position,
            created_at: now,
            updated_at: now,
        };
        Self::collection(db).insert_one(&suggestion).await?;
        Ok(suggestion)
    }

    pub async fn find_by_task(
        db: &Database,
        task_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<Suggestion>> {
        Self::collection(db)
            .find(doc! { "task_id": task_id })
            .sort(doc! { "position": 1 })
            .await?
            .try_collect()
            .await
    }

    pub async fn find_by_id(
        db: &Database,
        id: &ObjectId,
    ) -> mongodb::error::Result<Option<Suggestion>> {
        Self::collection(db).find_one(doc! { "_id": id }).await
    }

    pub async fn delete(db: &Database, id: &ObjectId) -> mongodb::error::Result<bool> {
        let result = Self::collection(db).delete_one(doc! { "_id": id }).await?;
        Ok(result.deleted_count > 0)
    }

    pub async fn set_dismissed(
        db: &Database,
        id: &ObjectId,
        dismissed: bool,
    ) -> mongodb::error::Result<Option<Suggestion>> {
        Self::collection(db)
            .update_one(
                doc! { "_id": id },
                doc! { "$set": { "dismissed": dismissed, "updated_at": DateTime::now() } },
            )
            .await?;
        Self::find_by_id(db, id).await
    }

    pub async fn add_vote(
        db: &Database,
        id: &ObjectId,
        user_id: &ObjectId,
    ) -> mongodb::error::Result<Option<Suggestion>> {
        Self::collection(db)
            .update_one(
                doc! { "_id": id },
                doc! {
                    "$addToSet": { "votes": user_id },
                    "$set": { "updated_at": DateTime::now() }
                },
            )
            .await?;
        Self::find_by_id(db, id).await
    }

    pub async fn remove_vote(
        db: &Database,
        id: &ObjectId,
        user_id: &ObjectId,
    ) -> mongodb::error::Result<Option<Suggestion>> {
        Self::collection(db)
            .update_one(
                doc! { "_id": id },
                doc! {
                    "$pull": { "votes": user_id },
                    "$set": { "updated_at": DateTime::now() }
                },
            )
            .await?;
        Self::find_by_id(db, id).await
    }

    pub async fn reorder(
        db: &Database,
        id: &ObjectId,
        before_id: Option<&ObjectId>,
        after_id: Option<&ObjectId>,
    ) -> mongodb::error::Result<Option<String>> {
        let suggestion = match Self::find_by_id(db, id).await? {
            Some(s) => s,
            None => return Ok(None),
        };

        let before_pos = match before_id {
            Some(bid) => Self::find_by_id(db, bid).await?.map(|s| s.position),
            None => None,
        };
        let after_pos = match after_id {
            Some(aid) => Self::find_by_id(db, aid).await?.map(|s| s.position),
            None => None,
        };

        let new_position = match (before_pos.as_deref(), after_pos.as_deref()) {
            (None, None) => suggestion.position.clone(),
            (Some(before), None) => position_after(before),
            (None, Some(after)) => position_before(after),
            (Some(before), Some(after)) => {
                position_between(before, after).unwrap_or_else(|| position_after(before))
            }
        };

        Self::collection(db)
            .update_one(
                doc! { "_id": id },
                doc! { "$set": { "position": &new_position, "updated_at": DateTime::now() } },
            )
            .await?;

        Ok(Some(new_position))
    }
}
