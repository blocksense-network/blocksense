use anyhow::Result;
use blocksense_utils::logging::{
    get_log_level, init_shared_logging_handle, tokio_console_active, SharedLoggingHandle,
};
use eth_relayer::updates_reader::updates_reader_loop;
use futures::stream::FuturesUnordered;
use std::io::Error;
use tokio::task::JoinHandle;

#[tokio::main]
async fn main() -> Result<()> {
    let _log_handle: SharedLoggingHandle = init_shared_logging_handle(
        get_log_level("ETH_RELAYER").as_str(),
        tokio_console_active("ETH_RELAYER", false),
    );

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
