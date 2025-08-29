use std::fmt::Write;

use blocksense_data_providers_sdk::price_data::types::PairsToResults;
use blocksense_sdk::oracle::{DataFeedResultValue, Payload};
use itertools::Itertools;
use prettytable::{format, Cell, Row, Table};
use tracing::{info, warn};

use crate::domain::ResourcePairData;

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
pub fn print_results(resources: &[ResourcePairData], results: &PairsToResults, payload: &Payload) {
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

    warn!("{pairs_with_missing_provider_data_count} Pairs with no provider data:");
    warn!("[{pairs_with_missing_provider_data}]");

    warn!("{missing_prices_count} Pairs with missing price / volume data from provider:");
    warn!("[{missing_prices}]");

    info!("Results:");
    table.printstd();
}
