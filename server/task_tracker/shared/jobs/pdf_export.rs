use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct PdfExportJob {
    pub export_id: Uuid,
}
