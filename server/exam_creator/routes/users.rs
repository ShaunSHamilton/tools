use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, oid::ObjectId};
use http::StatusCode;
use mongodb::bson::doc;
use tracing::instrument;

use crate::exam_creator::{
    database::prisma,
    errors::Error,
    state::{ServerState, SessionUser, User},
};

/// Get all users online (in state)
#[instrument(skip_all, err(Debug), level = "debug")]
pub async fn get_users(
    _: prisma::ExamCreatorUser,
    State(state): State<ServerState>,
) -> Result<Json<Vec<User>>, Error> {
    let users = &state.client_sync.lock().unwrap().users;

    Ok(Json(users.clone()))
}

/// Get current session user
#[instrument(skip_all, err(Debug), level = "debug")]
pub async fn get_session_user(
    exam_creator_user: prisma::ExamCreatorUser,
    State(server_state): State<ServerState>,
) -> Result<Json<SessionUser>, Error> {
    let users = &server_state
        .client_sync
        .lock()
        .expect("unable to lock client_sync mutex")
        .users;
    let User {
        name,
        email,
        picture,
        activity,
        settings,
    } = exam_creator_user.to_session(&users);

    let session_user = SessionUser {
        name,
        email,
        picture,
        activity,
        settings,
    };

    Ok(Json(session_user))
}

pub async fn put_user_settings(
    exam_creator_user: prisma::ExamCreatorUser,
    State(server_state): State<ServerState>,
    Json(new_settings): Json<prisma::ExamCreatorUserSettings>,
) -> Result<Json<prisma::ExamCreatorUserSettings>, Error> {
    let new_settings = mongodb::bson::serialize_to_bson(&new_settings)?;
    let _update_result = server_state
        .production_database
        .exam_creator_user
        .update_one(
            doc! { "_id": exam_creator_user.id },
            doc! { "$set": { "settings": new_settings } },
        )
        .await?;

    let updated_user = server_state
        .production_database
        .exam_creator_user
        .find_one(doc! { "_id": exam_creator_user.id })
        .await?
        .ok_or(Error::Server(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("could not find user after update: {}", exam_creator_user.id),
        ))?;

    let settings = updated_user.settings;

    // Update state
    let client_sync = &mut server_state.client_sync.lock().unwrap();
    if let Some(user) = client_sync
        .users
        .iter_mut()
        .find(|u| u.email == updated_user.email)
    {
        user.settings = settings.clone();
    }

    Ok(Json(settings))
}

#[instrument(skip_all, err(Debug), level = "debug")]
pub async fn get_user_by_id(
    _: prisma::ExamCreatorUser,
    State(state): State<ServerState>,
    Path(user_id): Path<ObjectId>,
) -> Result<Json<Document>, Error> {
    let user = state
        .staging_database
        .user
        .find_one(doc! {"_id": user_id})
        .await?
        .ok_or(Error::Server(
            StatusCode::BAD_REQUEST,
            format!("user non-existent for id: {user_id}"),
        ))?;

    Ok(Json(user))
}
