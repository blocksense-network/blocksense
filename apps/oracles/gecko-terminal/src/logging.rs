use blocksense_sdk::oracle::{
    logging::{print_oracle_results, LoggingConfig, PriceResultsAccessor, ResourceLogEntry},
    Payload,
};
use prettytable::{format, Cell, Row, Table};
use tracing::info;

use crate::{FeedConfig, GeckoTerminalDataForFeed};

impl ResourceLogEntry for FeedConfig {
    fn get_id_str(&self) -> String {
        self.id.clone()
    }

    fn get_display_name(&self) -> String {
        format!("{} / {}", self.pair.base, self.pair.quote)
    }
}

pub struct GeckoResultsView<'a>(pub &'a GeckoTerminalDataForFeed);

impl<'a> PriceResultsAccessor for GeckoResultsView<'a> {
    fn has(&self, id: &str) -> bool {
        self.0.contains_key(id)
    }

    fn provider_names(&self, id: &str) -> Vec<String> {
        self.0
            .get(id)
            .map(|pools| {
                pools
                    .iter()
                    .filter(|pool| pool.check_volume_usd())
                    .map(|pool| format!("{} / {}", pool.network, pool.pool))
                    .collect()
            })
            .unwrap_or_default()
    }
}

pub fn print_responses(responses: &GeckoTerminalDataForFeed) {
    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    table.set_titles(Row::new(vec![
        Cell::new("Feed ID").style_spec("bc"),
        Cell::new("Network").style_spec("bc"),
        Cell::new("Name").style_spec("bc"),
        Cell::new("Reverse").style_spec("bc"),
        Cell::new("Price[USD]").style_spec("bc"),
        Cell::new("Volume[USD]").style_spec("bc"),
        Cell::new("Enough volume").style_spec("bc"),
        Cell::new("Pool").style_spec("bc"),
    ]));

    let mut first_row = true;
    let mut feed_ids = responses.keys().cloned().collect::<Vec<String>>();
    feed_ids.sort();

    for feed_id in feed_ids {
        if let Some(data) = responses.get(&feed_id) {
            if !first_row {
                table.add_empty_row();
            } else {
                first_row = false;
            }
            for d in data {
                let price = d.get_price();
                let enough_volume = if d.check_volume_usd() {
                    "Yes".to_string()
                } else {
                    "No".to_string()
                };
                table.add_row(Row::new(vec![
                    Cell::new(&d.feed_id).style_spec("r"),
                    Cell::new(&d.network).style_spec("l"),
                    Cell::new(&d.attributes.name).style_spec("l"),
                    Cell::new(&d.reverse.to_string()).style_spec("l"),
                    Cell::new(&price.to_string()).style_spec("r"),
                    Cell::new(&d.attributes.volume_usd.h24.to_string()).style_spec("r"),
                    Cell::new(&enough_volume).style_spec("r"),
                    Cell::new(&d.pool).style_spec("l"),
                ]));
            }
        }
    }

    info!("\nResponses:\n{}", table.to_string().replace("\r\n", "\n"));
}

pub fn print_results(
    resources: &[FeedConfig],
    responses: &GeckoTerminalDataForFeed,
    payload: &Payload,
) {
    print_responses(responses);
    let view = GeckoResultsView(responses);
    print_oracle_results(
        resources,
        payload,
        LoggingConfig::with_additional_results_analysis(&view),
    );
}
