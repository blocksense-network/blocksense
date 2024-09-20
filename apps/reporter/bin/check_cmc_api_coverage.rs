use std::thread;
use std::time::Duration;

use data_feeds::interfaces::data_feed::DataFeed;
use data_feeds::services::coinmarketcap::CoinMarketCapDataFeed;
use feed_registry::registry::AllFeedsConfig;
use feed_registry::types::FeedResult;
use config::get_validated_config;
use utils::constants::{FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE, REPORTER_CONFIG_DIR, REPORTER_CONFIG_FILE};
use utils::get_config_file_path;

/// Checks if all assets are available from CMC API and prints non-available pairs
/// takes 5m+ to run
fn main() {
    let config_file_path: std::path::PathBuf = get_config_file_path(REPORTER_CONFIG_DIR, REPORTER_CONFIG_FILE);
    let reporter_config = get_validated_config::<config::ReporterConfig>(&config_file_path).expect("Failed to get config: ");

    let cmc_api_key_path = reporter_config
        .resources
        .get("CMC_API_KEY_PATH")
        .expect("CMC_API_KEY_PATH not provided in config!");
    let cmc_api_key_path = std::env::var("BLOCKSENSE_ROOT")
        .expect("BLOCKSENSE_ROOT env not set")
        .to_string()
        + cmc_api_key_path;

    let feeds_config_file = get_config_file_path(FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE);
    let all_feeds_config = get_validated_config::<AllFeedsConfig>(&feeds_config_file).expect("Failed to get config: ");

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
