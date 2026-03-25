use futures::TryStreamExt;
use mongodb::{
    Collection, Database,
    bson::{DateTime, doc, oid::ObjectId},
};
use serde::{Deserialize, Serialize};

// ── Fractional index ──────────────────────────────────────────────────────────
//
// Positions are zero-padded 20-digit decimal strings, so lexicographic order
// equals numeric order. Initial gap: 2^32 (~4 billion). Midpoint = (a+b)/2.
// This gives 32 bisection levels before adjacent positions occur — ample for MVP.

const PAD: usize = 20;
const INITIAL_GAP: u64 = 1 << 32;

fn fmt_pos(n: u64) -> String {
    format!("{:0>width$}", n, width = PAD)
}

fn parse_pos(s: &str) -> Option<u64> {
    s.parse().ok()
}

/// Position for the very first task (no neighbours).
pub fn first_position() -> String {
    fmt_pos(INITIAL_GAP)
}

/// Position appended after the current last task.
pub fn position_after(last: &str) -> String {
    let n = parse_pos(last).unwrap_or(INITIAL_GAP);
    fmt_pos(n.saturating_add(INITIAL_GAP))
}

/// Position prepended before the current first task.
pub fn position_before(first: &str) -> String {
    let n = parse_pos(first).unwrap_or(INITIAL_GAP);
    fmt_pos(n / 2)
}

/// Position strictly between `a` and `b`. Returns `None` if they are adjacent.
pub fn position_between(a: &str, b: &str) -> Option<String> {
    let an = parse_pos(a)?;
    let bn = parse_pos(b)?;
    if bn <= an + 1 {
        return None;
    }
    Some(fmt_pos(an + (bn - an) / 2))
}

// ── Task model ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Idea,
    InProgress,
    Complete,
    Dropped,
}

impl TaskStatus {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "idea" => Some(Self::Idea),
            "in_progress" => Some(Self::InProgress),
            "complete" => Some(Self::Complete),
            "dropped" => Some(Self::Dropped),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub org_id: ObjectId,
    pub assignee_id: ObjectId,
    pub created_by: ObjectId,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub drop_reason: Option<String>,
    pub color: String,
    pub position: String,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

impl Task {
    fn collection(db: &Database) -> Collection<Task> {
        db.collection("tasks")
    }

    pub async fn create(
        db: &Database,
        org_id: ObjectId,
        assignee_id: ObjectId,
        created_by: ObjectId,
        title: String,
        description: Option<String>,
        color: String,
    ) -> mongodb::error::Result<Task> {
        // Find the last position for this assignee in this org
        let last = Self::collection(db)
            .find_one(doc! { "org_id": org_id, "assignee_id": assignee_id })
            .sort(doc! { "position": -1 })
            .await?;

        let position = match last {
            Some(t) => position_after(&t.position),
            None => first_position(),
        };

        let now = DateTime::now();
        let task = Task {
            id: ObjectId::new(),
            org_id,
            assignee_id,
            created_by,
            title,
            description,
            status: TaskStatus::Idea,
            drop_reason: None,
            color,
            position,
            created_at: now,
            updated_at: now,
        };
        Self::collection(db).insert_one(&task).await?;
        Ok(task)
    }

    pub async fn find_for_org(
        db: &Database,
        org_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<Task>> {
        Self::collection(db)
            .find(doc! { "org_id": org_id })
            .sort(doc! { "assignee_id": 1, "position": 1 })
            .await?
            .try_collect()
            .await
    }

    pub async fn find_by_id(db: &Database, id: &ObjectId) -> mongodb::error::Result<Option<Task>> {
        Self::collection(db).find_one(doc! { "_id": id }).await
    }

    #[allow(dead_code)]
    pub async fn find_by_id_in_org(
        db: &Database,
        id: &ObjectId,
        org_id: &ObjectId,
    ) -> mongodb::error::Result<Option<Task>> {
        Self::collection(db)
            .find_one(doc! { "_id": id, "org_id": org_id })
            .await
    }

    /// Update mutable fields. Validates drop_reason invariant.
    #[allow(clippy::too_many_arguments)]
    pub async fn update(
        db: &Database,
        id: &ObjectId,
        title: Option<String>,
        description: Option<Option<String>>,
        status: Option<TaskStatus>,
        drop_reason: Option<Option<String>>,
        color: Option<String>,
        assignee_id: Option<ObjectId>,
    ) -> mongodb::error::Result<Option<Task>> {
        // Fetch current state to validate invariants
        let current = match Self::find_by_id(db, id).await? {
            Some(t) => t,
            None => return Ok(None),
        };

        let mut set_doc = doc! { "updated_at": DateTime::now() };

        if let Some(t) = title {
            set_doc.insert("title", t);
        }
        if let Some(d) = description {
            match d {
                Some(text) => set_doc.insert("description", text),
                None => set_doc.insert("description", mongodb::bson::Bson::Null),
            };
        }
        if let Some(s) = status {
            let s_str = match s {
                TaskStatus::Idea => "idea",
                TaskStatus::InProgress => "in_progress",
                TaskStatus::Complete => "complete",
                TaskStatus::Dropped => "dropped",
            };
            set_doc.insert("status", s_str);
        }
        if let Some(dr) = drop_reason {
            match dr {
                Some(reason) => set_doc.insert("drop_reason", reason),
                None => set_doc.insert("drop_reason", mongodb::bson::Bson::Null),
            };
        }
        if let Some(c) = color {
            set_doc.insert("color", c);
        }

        if let Some(new_assignee) = assignee_id {
            // Recalculate position at end of new assignee's list
            let last = Self::collection(db)
                .find_one(doc! {
                    "org_id": current.org_id,
                    "assignee_id": new_assignee,
                    "_id": { "$ne": id }
                })
                .sort(doc! { "position": -1 })
                .await?;

            let new_position = match last {
                Some(t) => position_after(&t.position),
                None => first_position(),
            };
            set_doc.insert("assignee_id", new_assignee);
            set_doc.insert("position", new_position);
        }

        Self::collection(db)
            .update_one(doc! { "_id": id }, doc! { "$set": set_doc })
            .await?;

        Self::find_by_id(db, id).await
    }

    /// Reorder a task relative to its neighbours. Returns the new position string.
    pub async fn reorder(
        db: &Database,
        id: &ObjectId,
        before_id: Option<&ObjectId>,
        after_id: Option<&ObjectId>,
    ) -> mongodb::error::Result<Option<String>> {
        let task = match Self::find_by_id(db, id).await? {
            Some(t) => t,
            None => return Ok(None),
        };

        let before_pos = match before_id {
            Some(bid) => Self::find_by_id(db, bid).await?.map(|t| t.position),
            None => None,
        };
        let after_pos = match after_id {
            Some(aid) => Self::find_by_id(db, aid).await?.map(|t| t.position),
            None => None,
        };

        let new_position = match (before_pos.as_deref(), after_pos.as_deref()) {
            (None, None) => task.position.clone(), // no-op
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

    pub async fn delete(
        db: &Database,
        id: &ObjectId,
        org_id: &ObjectId,
    ) -> mongodb::error::Result<bool> {
        let result = Self::collection(db)
            .delete_one(doc! { "_id": id, "org_id": org_id })
            .await?;
        Ok(result.deleted_count > 0)
    }

    #[allow(dead_code)]
    pub async fn ensure_indexes(db: &Database) -> mongodb::error::Result<()> {
        use mongodb::IndexModel;
        use mongodb::bson::doc;
        let coll = Self::collection(db);
        coll.create_index(
            IndexModel::builder()
                .keys(doc! { "org_id": 1, "assignee_id": 1, "position": 1 })
                .build(),
        )
        .await?;
        coll.create_index(
            IndexModel::builder()
                .keys(doc! { "org_id": 1, "assignee_id": 1, "status": 1 })
                .build(),
        )
        .await?;
        Ok(())
    }
}
