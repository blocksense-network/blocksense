mod fetch_prices;
mod types;
mod utils;

use std::{collections::HashMap, fmt::Write};

use anyhow::{Context, Error, Result};
use itertools::Itertools;
use prettytable::{format, Cell, Row, Table};

use blocksense_data_providers_sdk::price_data::types::{PairsToResults, ProvidersSymbols};
use blocksense_data_providers_sdk::price_data::wap::vwap::compute_vwap;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use chrono::Utc;
use chrono_tz::US::Eastern;

use types::{Capabilities, FeedConfigData, ResourceData, ResourcePairData};

use crate::fetch_prices::get_prices;
use crate::utils::markets_are_closed;

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let now_et = Utc::now().with_timezone(&Eastern);
    if markets_are_closed(now_et) {
        println!("❌ Markets are closed. Prices can't be fetched.");
        return Err(Error::msg("Markets are closed. Prices can't be fetched."));
    }

    println!("Starting oracle component - Stock Price Feeds");

    let capabilities = get_capabilities_from_settings(&settings);
    let resources = get_resources_from_settings(&settings)?;

    let results = get_prices(&resources, &capabilities).await?;
    let payload = process_results(&results)?;

    print_results(&resources.pairs, &results, &payload);

    Ok(payload)
}

fn process_results(results: &PairsToResults) -> Result<Payload> {
    let mut payload = Payload::new();
    for (feed_id, results) in results.iter() {
        let price_points = results.providers_data.values();

        payload.values.push(match compute_vwap(price_points) {
            Ok(price) => DataFeedResult {
                id: feed_id.to_string(),
                value: DataFeedResultValue::Numerical(price),
            },
            Err(err) => DataFeedResult {
                id: feed_id.to_string(),
                value: DataFeedResultValue::Error(err.to_string()),
            },
        });
    }

    Ok(payload)
}

fn get_capabilities_from_settings(settings: &Settings) -> Capabilities {
    settings
        .capabilities
        .iter()
        .map(|cap| (cap.id.to_string(), cap.data.to_string()))
        .collect()
}

fn get_resources_from_settings(settings: &Settings) -> Result<ResourceData> {
    let mut feeds_data = Vec::new();
    let mut providers_symbols: ProvidersSymbols = HashMap::new();

    for feed_setting in &settings.data_feeds {
        let feed_config_data: FeedConfigData =
            serde_json::from_str(&feed_setting.data).context("Couldn't parse data feed")?;

        let base = &feed_config_data.pair.base;

        feeds_data.push(ResourcePairData {
            pair: feed_config_data.pair.clone(),
            id: feed_setting.id.clone(),
        });

        if let Some(providers) = &feed_config_data.arguments.providers {
            for provider in providers {
                let symbols = providers_symbols.entry(provider.clone()).or_default();

                if !symbols.contains(base) {
                    symbols.push(base.clone());
                }
            }
        }
    }

    Ok(ResourceData {
        pairs: feeds_data,
        symbols: providers_symbols,
    })
}

struct ResultInfo {
    pub id: i64,
    pub name: String,
    pub value: String,
    pub providers: Vec<String>,
}

/*TODO:(EmilIvanichkovv):
    The `print_results` function is very similar to the one we use in `cex-price-feeds` oracle.
    It should be moved to blocksense-sdk
*/
fn print_results(resources: &[ResourcePairData], results: &PairsToResults, payload: &Payload) {
    let mut results_info: Vec<ResultInfo> = Vec::new();
    let mut pairs_with_missing_provider_data: String = String::new();
    let mut pairs_with_missing_provider_data_count = 0;
    let mut missing_prices: String = String::new();
    let mut missing_prices_count = 0;

    for resource in resources.iter() {
        if results.get(&resource.id).is_some() {
            let providers = results
                .get(&resource.id)
                .map(|res| {
                    res.providers_data
                        .keys()
                        .map(|x| x.split(' ').next().unwrap().to_string())
                        .unique()
                        .collect()
                })
                .unwrap_or_default();

            let value = match payload
                .values
                .iter()
                .find(|x| x.id == resource.id)
                .unwrap()
                .value
                .clone()
            {
                DataFeedResultValue::Numerical(num) => format!("{num:.8}"),
                _ => {
                    missing_prices_count += 1;
                    write!(
                        missing_prices,
                        "{{ {}: {} / {}, providers: {:?} }},",
                        resource.id, resource.pair.base, resource.pair.quote, providers
                    )
                    .unwrap();
                    "-".to_string()
                }
            };

            results_info.push(ResultInfo {
                id: resource.id.parse().unwrap(),
                name: format!("{} / {}", resource.pair.base, resource.pair.quote),
                value,
                providers,
            });
        } else {
            pairs_with_missing_provider_data_count += 1;
            write!(
                pairs_with_missing_provider_data,
                "{{ {}: {} / {} }},",
                resource.id, resource.pair.base, resource.pair.quote
            )
            .unwrap();
        }
    }

    results_info.sort_by(|a, b| a.id.cmp(&b.id));

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    table.set_titles(Row::new(vec![
        Cell::new("ID").style_spec("bc"),
        Cell::new("Name").style_spec("bc"),
        Cell::new("Value").style_spec("bc"),
        Cell::new("Providers").style_spec("bc"),
    ]));

    for data in results_info {
        table.add_row(Row::new(vec![
            Cell::new(&data.id.to_string()).style_spec("r"),
            Cell::new(&data.name).style_spec("r"),
            Cell::new(&data.value).style_spec("r"),
            Cell::new(&data.providers.len().to_string()).style_spec("r"),
        ]));
    }

    println!("\n{pairs_with_missing_provider_data_count} Pairs with no provider data:");
    println!("[{pairs_with_missing_provider_data}]");

    println!("\n{missing_prices_count} Pairs with missing price / volume data from provider:");
    println!("[{missing_prices}]");

    println!("\nResults:");
    table.printstd();
}
