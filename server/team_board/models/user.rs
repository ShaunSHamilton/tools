use mongodb::{
    Collection, Database,
    bson::{DateTime, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    pub email: String,
    pub created_at: DateTime,
    pub github_id: Option<i64>,
    pub picture: Option<String>,
    pub display_name: Option<String>,
    pub show_live_cursors: Option<bool>,
}

impl User {
    fn collection(db: &Database) -> Collection<User> {
        db.collection("users")
    }

    pub async fn find_by_email(db: &Database, email: &str) -> mongodb::error::Result<Option<User>> {
        Self::collection(db).find_one(doc! { "email": email }).await
    }

    pub async fn find_by_id(db: &Database, id: &ObjectId) -> mongodb::error::Result<Option<User>> {
        Self::collection(db).find_one(doc! { "_id": id }).await
    }

    pub async fn create(
        db: &Database,
        name: String,
        email: String,
    ) -> mongodb::error::Result<User> {
        let user = User {
            id: ObjectId::new(),
            name,
            email,
            created_at: DateTime::now(),
            github_id: None,
            picture: None,
            display_name: None,
            show_live_cursors: None,
        };
        Self::collection(db).insert_one(&user).await?;
        Ok(user)
    }

    pub async fn update_settings(
        db: &Database,
        id: &ObjectId,
        display_name: Option<Option<String>>,
        show_live_cursors: Option<bool>,
    ) -> mongodb::error::Result<Option<User>> {
        use mongodb::bson::Document;

        let mut set_doc = Document::new();
        let mut unset_doc = Document::new();

        if let Some(dn) = display_name {
            match dn {
                Some(name) => { set_doc.insert("display_name", name); }
                None => { unset_doc.insert("display_name", ""); }
            }
        }
        if let Some(slc) = show_live_cursors {
            set_doc.insert("show_live_cursors", slc);
        }

        if set_doc.is_empty() && unset_doc.is_empty() {
            return Self::find_by_id(db, id).await;
        }

        let mut update_doc = Document::new();
        if !set_doc.is_empty() {
            update_doc.insert("$set", set_doc);
        }
        if !unset_doc.is_empty() {
            update_doc.insert("$unset", unset_doc);
        }

        Self::collection(db)
            .find_one_and_update(doc! { "_id": id }, update_doc)
            .return_document(mongodb::options::ReturnDocument::After)
            .await
    }

    /// Find a user by GitHub ID, or create one if not found.
    /// Also updates picture on every login.
    pub async fn find_or_create_by_github(
        db: &Database,
        github_id: i64,
        name: String,
        email: String,
        picture: String,
    ) -> mongodb::error::Result<User> {
        // Try by github_id first, fall back to email for legacy users
        let existing = match Self::collection(db)
            .find_one(doc! { "github_id": github_id })
            .await?
        {
            Some(u) => Some(u),
            None => Self::find_by_email(db, &email).await?,
        };

        match existing {
            Some(u) => {
                Self::collection(db)
                    .update_one(
                        doc! { "_id": u.id },
                        doc! { "$set": { "github_id": github_id, "picture": &picture } },
                    )
                    .await?;
                Ok(User { github_id: Some(github_id), picture: Some(picture), ..u })
            }
            None => {
                let user = User {
                    id: ObjectId::new(),
                    name,
                    email,
                    created_at: DateTime::now(),
                    github_id: Some(github_id),
                    picture: Some(picture),
                    display_name: None,
                    show_live_cursors: None,
                };
                Self::collection(db).insert_one(&user).await?;
                Ok(user)
            }
        }
    }
}
