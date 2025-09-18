use prettytable::{format, Cell, Row, Table};
use tracing::{info, warn};

use super::{DataFeedResultValue, Payload};

pub trait ResourceLogEntry {
    fn get_id_str(&self) -> String;
    fn get_display_name(&self) -> String;
}

pub trait PriceResultsAccessor {
    fn has(&self, id: &str) -> bool;
    fn provider_names(&self, id: &str) -> Vec<String>;
}

#[derive(Default)]
pub struct LoggingConfig<'a> {
    pub name_column_label: &'a str,
    pub show_providers: bool,
    pub provider_results: Option<&'a dyn PriceResultsAccessor>,
}

impl<'a> LoggingConfig<'a> {
    const NAME_COLUMN_LABEL: &'static str = "Name";

    pub fn with_additional_results_analysis(
        provider_results: &'a dyn PriceResultsAccessor,
    ) -> Self {
        Self {
            name_column_label: Self::NAME_COLUMN_LABEL,
            show_providers: true,
            provider_results: Some(provider_results),
        }
    }

    pub fn basic() -> Self {
        Self {
            name_column_label: Self::NAME_COLUMN_LABEL,
            show_providers: false,
            provider_results: None,
        }
    }
}

pub fn print_oracle_results<T>(resources: &[T], payload: &Payload, config: LoggingConfig)
where
    T: ResourceLogEntry,
{
    struct ResultInfo {
        id: String,
        name: String,
        value: String,
        providers: Vec<String>,
    }

    let mut missing_prices = String::new();
    let mut missing_prices_count = 0;
    let mut track_missing_price = |id_str: &str, name: &str, providers: &[String]| {
        missing_prices_count += 1;
        use std::fmt::Write as _;
        let _ = write!(
            &mut missing_prices,
            "{{ {}: {}, providers: {:?} }},",
            id_str, name, providers
        );
        "-".to_string()
    };

    let mut results_info: Vec<ResultInfo> = Vec::new();
    let mut pairs_with_missing_provider_data = String::new();
    let mut pairs_with_missing_provider_data_count = 0;

    for resource in resources.iter() {
        let id_str = resource.get_id_str();
        let providers = if let Some(provider_results) = config.provider_results {
            if provider_results.has(&id_str) {
                provider_results.provider_names(&id_str)
            } else {
                // Track missing provider data
                pairs_with_missing_provider_data_count += 1;
                use std::fmt::Write as _;
                let _ = write!(
                    &mut pairs_with_missing_provider_data,
                    "{{ {}: {} }},",
                    id_str,
                    resource.get_display_name()
                );
                Vec::new()
            }
        } else {
            Vec::new()
        };

        let value = if !providers.is_empty() || config.provider_results.is_none() {
            // Only process resources that have provider data (or when provider_results is None)
            payload
                .values
                .iter()
                .find(|x| x.id == id_str)
                .and_then(|v| match &v.value {
                    DataFeedResultValue::Numerical(num) => Some(format!("{num:.8}")),
                    _ => None,
                })
                .unwrap_or_else(|| {
                    track_missing_price(&id_str, &resource.get_display_name(), &providers)
                })
        } else {
            // No provider data or price info, skip price processing
            "-".to_string()
        };

        results_info.push(ResultInfo {
            id: id_str.clone(),
            name: resource.get_display_name(),
            value,
            providers,
        });
    }

    results_info.sort_by(|a, b| a.id.cmp(&b.id));

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    let mut headers = vec![
        Cell::new("Feed ID").style_spec("bc"),
        Cell::new(config.name_column_label).style_spec("bc"),
        Cell::new("Value").style_spec("bc"),
    ];

    if config.show_providers {
        headers.push(Cell::new("Providers").style_spec("bc"));
    }

    table.set_titles(Row::new(headers));

    for data in results_info {
        let mut row = vec![
            Cell::new(&data.id).style_spec("r"),
            Cell::new(&data.name).style_spec("r"),
            Cell::new(&data.value).style_spec("r"),
        ];

        if config.show_providers {
            row.push(Cell::new(&data.providers.len().to_string()).style_spec("r"));
        }

        table.add_row(Row::new(row));
    }

    if config.provider_results.is_some() {
        if pairs_with_missing_provider_data_count > 0 {
            warn!(
                "\n{} Pairs with no provider data:\n [{}]",
                pairs_with_missing_provider_data_count, pairs_with_missing_provider_data
            );
        }

        if missing_prices_count > 0 {
            warn!(
                "\n{} Pairs with missing price / volume data from provider:\n [{}]",
                missing_prices_count, missing_prices
            );
        }
    }

    info!("\nResults:\n{}", table.to_string().replace("\r\n", "\n"));
}
