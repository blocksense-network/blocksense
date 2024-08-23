use std::thread;
use std::time::Duration;

use data_feeds::interfaces::data_feed::DataFeed;
use data_feeds::orchestrator::init_reporter_config;
use data_feeds::services::coinmarketcap::CoinMarketCapDataFeed;
use feed_registry::registry::init_feeds_config;
use feed_registry::types::FeedResult;

/// Checks if all assets are available from CMC API and prints non-available pairs
/// takes 5m+ to run
fn main() {
    let reporter_config = init_reporter_config();

    let cmc_api_key_path = reporter_config
        .resources
        .get("CMC_API_KEY_PATH")
        .expect("CMC_API_KEY_PATH not provided in config!");
    let cmc_api_key_path = std::env::var("BLOCKSENSE_ROOT")
        .expect("BLOCKSENSE_ROOT env not set")
        .to_string()
        + cmc_api_key_path;

    let all_feeds_config = init_feeds_config();

    let mut cmc_feed = CoinMarketCapDataFeed::new(cmc_api_key_path);

    let mut feeds_not_working = Vec::new();

    for feed_config in all_feeds_config.feeds {
        if feed_config.script == "CoinMarketCap" {
            let result = cmc_feed.poll(&feed_config.name);

            println!("Testing {}..\nResult: {:?}", &feed_config.name, result);

            if !matches!(result.0, FeedResult::Result { .. }) {
                feeds_not_working.push(feed_config.name)
            }

            // Modify Sleep Duration in case of rate-limit
            thread::sleep(Duration::from_secs(5));
        }
    }

    println!("{:?}", feeds_not_working);

    assert_eq!(feeds_not_working.len(), 0)
}
