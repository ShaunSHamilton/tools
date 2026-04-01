use mongodb::bson::oid::ObjectId;

#[derive(Debug, Clone)]
pub struct ReportGenerationJob {
    pub report_id: ObjectId,
}
