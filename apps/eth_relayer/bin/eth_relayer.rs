use anyhow::Result;
use blocksense_config::{get_eth_relayer_config, get_feeds_config};
use blocksense_utils::logging::{
    get_log_level, init_shared_logging_handle, tokio_console_active, SharedLoggingHandle,
};
use eth_relayer::{
    providers::{eth_send_utils::create_relayers_channels, provider::init_shared_rpc_providers},
    updates_reader::updates_reader_loop,
};
use futures::stream::FuturesUnordered;
use std::io::Error;
use tokio::task::JoinHandle;

#[tokio::main]
async fn main() -> Result<()> {
    let _log_handle: SharedLoggingHandle = init_shared_logging_handle(
        get_log_level("ETH_RELAYER").as_str(),
        tokio_console_active("ETH_RELAYER", false),
    );

    let eth_relayer_config = get_eth_relayer_config();

    let feeds_config = get_feeds_config();

    let providers = init_shared_rpc_providers(&eth_relayer_config, None, &feeds_config).await;

    let (relayers_send_channels, relayers_recv_channels) =
        create_relayers_channels(&providers).await;

    let collected_futures: FuturesUnordered<JoinHandle<Result<(), Error>>> =
        FuturesUnordered::new();

    let updates_reader = updates_reader_loop().await;

    collected_futures.push(updates_reader);

    let result = futures::future::join_all(collected_futures).await;
    for v in result {
        match v {
            Ok(res) => match res {
                Ok(x) => x,
                Err(e) => {
                    panic!("TaskError: {e}");
                }
            },
            Err(e) => {
                panic!("JoinError: {e} ");
            }
        }
    }

    Ok(())
}
