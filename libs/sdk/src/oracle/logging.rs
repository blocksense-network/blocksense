use prettytable::{format, Cell, Row, Table};
use tracing::{info, warn};

use super::{DataFeedResultValue, Payload};

pub trait PriceFeedResource {
    fn get_id(&self) -> &str;
    fn get_pair_display(&self) -> String;
}

pub trait GenericFeedResource {
    fn get_feed_id(&self) -> i64;
    fn get_display_name(&self) -> String;
}

pub trait PriceResultsAccessor {
    fn has(&self, id: &str) -> bool;
    fn provider_names(&self, id: &str) -> Vec<String>;
}

pub fn print_price_feed_results<T, R>(
    resources: &[T],
    results: &R,
    payload: &Payload,
    provider_label: &str,
    provider_noun: &str,
    add_leading_newlines: bool,
) where
    T: PriceFeedResource,
    R: PriceResultsAccessor,
{
    struct ResultInfo {
        id: i64,
        name: String,
        value: String,
        providers: Vec<String>,
    }

    let mut results_info: Vec<ResultInfo> = Vec::new();
    let mut pairs_with_missing_provider_data: String = String::new();
    let mut pairs_with_missing_provider_data_count = 0;
    let mut missing_prices: String = String::new();
    let mut missing_prices_count = 0;

    for resource in resources.iter() {
        let id = resource.get_id();
        if results.has(id) {
            let providers = results.provider_names(id);

            let value = match payload.values.iter().find(|x| x.id == id) {
                Some(v) => match &v.value {
                    DataFeedResultValue::Numerical(num) => format!("{num:.8}"),
                    _ => {
                        missing_prices_count += 1;
                        let name = resource.get_pair_display();
                        use std::fmt::Write as _;
                        let _ = write!(
                            &mut missing_prices,
                            "{{ {}: {}, {}: {:?} }},",
                            id,
                            name,
                            provider_label.to_lowercase(),
                            providers
                        );
                        "-".to_string()
                    }
                },
                None => {
                    missing_prices_count += 1;
                    let name = resource.get_pair_display();
                    use std::fmt::Write as _;
                    let _ = write!(
                        &mut missing_prices,
                        "{{ {}: {}, {}: {:?} }},",
                        id,
                        name,
                        provider_label.to_lowercase(),
                        providers
                    );
                    "-".to_string()
                }
            };

            results_info.push(ResultInfo {
                id: id.parse().unwrap_or_default(),
                name: resource.get_pair_display(),
                value,
                providers,
            });
        } else {
            pairs_with_missing_provider_data_count += 1;
            use std::fmt::Write as _;
            let _ = write!(
                &mut pairs_with_missing_provider_data,
                "{{ {}: {} }},",
                id,
                resource.get_pair_display()
            );
        }
    }

    results_info.sort_by(|a, b| a.id.cmp(&b.id));

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    table.set_titles(Row::new(vec![
        Cell::new("ID").style_spec("bc"),
        Cell::new("Name").style_spec("bc"),
        Cell::new("Value").style_spec("bc"),
        Cell::new(provider_label).style_spec("bc"),
    ]));

    for data in results_info {
        table.add_row(Row::new(vec![
            Cell::new(&data.id.to_string()).style_spec("r"),
            Cell::new(&data.name).style_spec("r"),
            Cell::new(&data.value).style_spec("r"),
            Cell::new(&data.providers.len().to_string()).style_spec("r"),
        ]));
    }

    if pairs_with_missing_provider_data_count > 0 {
        if add_leading_newlines {
            warn!(
                "\n{} Pairs with no {} data:",
                pairs_with_missing_provider_data_count, provider_noun
            );
        } else {
            warn!(
                "{} Pairs with no {} data:",
                pairs_with_missing_provider_data_count, provider_noun
            );
        }
        warn!("[{}]", pairs_with_missing_provider_data);
    }

    if missing_prices_count > 0 {
        if add_leading_newlines {
            warn!(
                "\n{} Pairs with missing price / volume data from {}:",
                missing_prices_count, provider_noun
            );
        } else {
            warn!(
                "{} Pairs with missing price / volume data from {}:",
                missing_prices_count, provider_noun
            );
        }
        warn!("[{}]", missing_prices);
    }

    if add_leading_newlines {
        info!("\nResults:");
    } else {
        info!("Results:");
    }
    table.printstd();
}

pub fn print_generic_payload<T>(payload: &Payload, resources: &[T], name_column_label: &str)
where
    T: GenericFeedResource,
{
    let mut sorted: Vec<&T> = resources.iter().collect();
    sorted.sort_by_key(|r| r.get_feed_id());

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);
    table.set_titles(Row::new(vec![
        Cell::new("Feed ID"),
        Cell::new(name_column_label),
        Cell::new("Value"),
    ]));

    for r in sorted {
        let id = r.get_feed_id().to_string();
        let value = payload.values.iter().find(|v| v.id == id);
        let display_value = match value {
            Some(v) => format!("{:?}", v.value),
            None => "No Data".to_string(),
        };

        table.add_row(Row::new(vec![
            Cell::new(&id),
            Cell::new(&r.get_display_name()),
            Cell::new(&display_value),
        ]));
    }

    table.printstd();
}
