mod fetch_prices;
mod types;

use anyhow::{Context, Result};
use itertools::Itertools;
use prettytable::{format, Cell, Row, Table};
use std::{collections::HashMap, fmt::Write};

use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    traits::prices_fetcher::PricePoint,
};

use fetch_prices::fetch_all_prices;
use types::{FeedConfigData, PairToResults, ProvidersSymbols, ResourceData, ResourcePairData};

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    println!("Starting oracle component - Stock Price Feeds");

    let resources = get_resources_from_settings(&settings)?;

    let results = fetch_all_prices(&resources).await?;
    let payload = process_results(&results)?;

    print_results(&resources.pairs, &results, &payload);

    Ok(payload)
}

fn process_results(results: &PairToResults) -> Result<Payload> {
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
    The `print_results` function is very similar to the one we use in `crypto-price-feeds` oracle.
    It should be moved to blocksense-sdk
*/
fn print_results(resources: &[ResourcePairData], results: &PairToResults, payload: &Payload) {
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

    println!(
        "\n{} Pairs with no provider data:",
        pairs_with_missing_provider_data_count
    );
    println!("[{}]", pairs_with_missing_provider_data);

    println!(
        "\n{} Pairs with missing price / volume data from provider:",
        missing_prices_count
    );
    println!("[{}]", missing_prices);

    println!("\nResults:");
    table.printstd();
}

/*TODO:(EmilIvanichkovv):
    This is a copy-paste from the `crypto-price-feeds` oracle.
    It should be moved to blocksense-sdk
*/
pub fn compute_vwap<'a>(price_points: impl IntoIterator<Item = &'a PricePoint>) -> Result<f64> {
    price_points
        .into_iter()
        .filter(|pp| pp.volume > 0.0)
        .map(|PricePoint { price, volume }| (price * volume, *volume))
        .reduce(|(num, denom), (weighted_price, volume)| (num + weighted_price, denom + volume))
        .context("No price points found")
        .map(|(weighted_prices_sum, total_volume)| weighted_prices_sum / total_volume)
}
