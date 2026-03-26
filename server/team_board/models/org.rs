use futures::TryStreamExt;
use mongodb::{
    Collection, Database,
    bson::{DateTime, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

use crate::auth::ApiUser;
use crate::team_board::routes::orgs::ApiMember;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Org {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub name: String,
    pub slug: String,
    pub created_by: ObjectId,
    pub created_at: DateTime,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Admin,
    Member,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgMember {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub org_id: ObjectId,
    pub user_id: ObjectId,
    pub role: Role,
    pub joined_at: DateTime,
}

const FCC_NAME: &str = "freeCodeCamp";
const FCC_SLUG: &str = "freecodecamp";

impl Org {
    fn collection(db: &Database) -> Collection<Org> {
        db.collection("organisations")
    }

    /// Ensures the user is a member of the freeCodeCamp org, creating the org
    /// if it doesn't exist yet. The first user to register becomes an admin;
    /// subsequent users are added as regular members.
    pub async fn ensure_freecodecamp_membership(
        db: &Database,
        user_id: ObjectId,
    ) -> mongodb::error::Result<()> {
        let org = match Self::collection(db)
            .find_one(doc! { "slug": FCC_SLUG })
            .await?
        {
            Some(org) => org,
            None => {
                let org = Org {
                    id: ObjectId::new(),
                    name: FCC_NAME.to_string(),
                    slug: FCC_SLUG.to_string(),
                    created_by: user_id,
                    created_at: DateTime::now(),
                };
                Self::collection(db).insert_one(&org).await?;
                OrgMember::add(db, org.id, user_id, Role::Admin).await?;
                return Ok(());
            }
        };

        if OrgMember::find(db, &org.id, &user_id).await?.is_none() {
            OrgMember::add(db, org.id, user_id, Role::Member).await?;
        }

        Ok(())
    }

    pub async fn create(
        db: &Database,
        name: String,
        created_by: ObjectId,
    ) -> mongodb::error::Result<Org> {
        let slug = slugify(&name);
        let org = Org {
            id: ObjectId::new(),
            slug,
            name,
            created_by,
            created_at: DateTime::now(),
        };
        Self::collection(db).insert_one(&org).await?;

        // Creator becomes first admin
        OrgMember::add(db, org.id, created_by, Role::Admin).await?;

        Ok(org)
    }

    pub async fn find_by_id(db: &Database, id: &ObjectId) -> mongodb::error::Result<Option<Org>> {
        Self::collection(db).find_one(doc! { "_id": id }).await
    }

    pub async fn find_for_user(
        db: &Database,
        user_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<Org>> {
        let memberships: Vec<OrgMember> = db
            .collection::<OrgMember>("org_members")
            .find(doc! { "user_id": user_id })
            .await?
            .try_collect()
            .await?;

        let org_ids: Vec<ObjectId> = memberships.into_iter().map(|m| m.org_id).collect();

        Self::collection(db)
            .find(doc! { "_id": { "$in": org_ids } })
            .await?
            .try_collect()
            .await
    }
}

impl OrgMember {
    fn collection(db: &Database) -> Collection<OrgMember> {
        db.collection("org_members")
    }

    pub async fn add(
        db: &Database,
        org_id: ObjectId,
        user_id: ObjectId,
        role: Role,
    ) -> mongodb::error::Result<OrgMember> {
        let member = OrgMember {
            id: ObjectId::new(),
            org_id,
            user_id,
            role,
            joined_at: DateTime::now(),
        };
        Self::collection(db).insert_one(&member).await?;
        Ok(member)
    }

    pub async fn find(
        db: &Database,
        org_id: &ObjectId,
        user_id: &ObjectId,
    ) -> mongodb::error::Result<Option<OrgMember>> {
        Self::collection(db)
            .find_one(doc! { "org_id": org_id, "user_id": user_id })
            .await
    }

    pub async fn remove(
        db: &Database,
        org_id: &ObjectId,
        user_id: &ObjectId,
    ) -> mongodb::error::Result<()> {
        Self::collection(db)
            .delete_one(doc! { "org_id": org_id, "user_id": user_id })
            .await?;
        Ok(())
    }

    pub async fn set_role(
        db: &Database,
        org_id: &ObjectId,
        user_id: &ObjectId,
        role: Role,
    ) -> mongodb::error::Result<()> {
        let role_str = match role {
            Role::Admin => "admin",
            Role::Member => "member",
        };
        Self::collection(db)
            .update_one(
                doc! { "org_id": org_id, "user_id": user_id },
                doc! { "$set": { "role": role_str } },
            )
            .await?;
        Ok(())
    }

    pub async fn count_admins(db: &Database, org_id: &ObjectId) -> mongodb::error::Result<u64> {
        Self::collection(db)
            .count_documents(doc! { "org_id": org_id, "role": "admin" })
            .await
    }

    /// Returns members with their user documents joined in Rust (no $lookup needed at this scale).
    ///
    /// `requester_is_admin` controls whether email addresses are included in the
    /// response. Admins see all emails; regular members see `null` / no email field.
    pub async fn find_members_with_users(
        db: &Database,
        org_id: &ObjectId,
        requester_is_admin: bool,
    ) -> mongodb::error::Result<Vec<ApiMember>> {
        let members: Vec<OrgMember> = Self::collection(db)
            .find(doc! { "org_id": org_id })
            .await?
            .try_collect()
            .await?;

        let user_ids: Vec<ObjectId> = members.iter().map(|m| m.user_id).collect();

        let users: Vec<crate::team_board::models::user::User> = db
            .collection::<crate::team_board::models::user::User>("users")
            .find(doc! { "_id": { "$in": &user_ids } })
            .await?
            .try_collect()
            .await?;

        let result = members
            .into_iter()
            .filter_map(|m| {
                users.iter().find(|u| u.id == m.user_id).map(|u| ApiMember {
                    user: if requester_is_admin {
                        ApiUser::from(u)
                    } else {
                        ApiUser::without_email(u)
                    },
                    role: format!("{:?}", m.role).to_lowercase(),
                    joined_at: m.joined_at.to_string(),
                })
            })
            .collect();

        Ok(result)
    }
}

fn slugify(name: &str) -> String {
    name.trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
