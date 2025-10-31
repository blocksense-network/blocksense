use std::time::Instant;

use anyhow::Result;
use futures::stream::StreamExt;
use futures::Stream;
use tracing::{info, warn};

use crate::sports_data::types::SportsResultData;

pub async fn fetch_all_results<S>(mut futures_set: S) -> Vec<SportsResultData>
where
    S: Stream<Item = (String, Result<Vec<u8>>)> + Unpin,
{
    let mut all_fetched_results = Vec::new();
    let before_fetch = Instant::now();

    // Process results as they complete
    while let Some((sport_type, result)) = futures_set.next().await {
        match result {
            Ok(ssz_encoded_result) => {
                let time_taken = before_fetch.elapsed();
                info!("ℹ️  Successfully fetched results for {sport_type} in {time_taken:?}");
                let result_data = SportsResultData {
                    sport_type: sport_type.to_owned(),
                    data: ssz_encoded_result,
                };
                all_fetched_results.push(result_data);
            }
            Err(err) => warn!("❌ Error fetching results for {sport_type}: {err:?}"),
        }
    }

    info!("🕛 All results fetched in {:?}", before_fetch.elapsed());

    all_fetched_results
}
