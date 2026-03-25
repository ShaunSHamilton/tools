use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ReportGenerationJob {
    pub report_id: Uuid,
}
