use blocksense_registry::config::FeedConfig;
use tokio::sync::mpsc;

#[derive(Debug, Clone)]
pub struct RegisterNewAssetFeed {
    pub config: FeedConfig,
}

#[derive(Debug, Clone)]
pub struct DeleteAssetFeed {
    pub id: u128,
}

#[allow(clippy::large_enum_variant)]
pub enum FeedsManagementCmds {
    RegisterNewAssetFeed(RegisterNewAssetFeed),
    DeleteAssetFeed(DeleteAssetFeed),
}

pub enum ProcessorResultValue {
    FeedsManagementCmds(
        Box<FeedsManagementCmds>,
        mpsc::UnboundedReceiver<FeedsManagementCmds>,
    ),
    ProcessorExitStatus(String),
}
