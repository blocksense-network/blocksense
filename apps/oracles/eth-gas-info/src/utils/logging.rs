use prettytable::{format, Cell, Row, Table};
use tracing::info;

use crate::domain::FeedConfig;
use crate::fetch::GasOraclePayload;

/// Print gas oracle results in a formatted table
pub fn print_gas_oracle_results(
    feed_configs: &[FeedConfig],
    gas_data: &GasOraclePayload,
    feed_ids: &[String],
) {
    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);
    table.set_titles(Row::new(vec![
        Cell::new("FeedID").style_spec("bc"),
        Cell::new("Metric").style_spec("bc"),
        Cell::new("Value(Gwei)").style_spec("bc"),
    ]));

    for (feed_id, config) in feed_ids.iter().zip(feed_configs.iter()) {
        let metric_value = gas_data.get_value_by_base(&config.pair.base);
        table.add_row(Row::new(vec![
            Cell::new(feed_id).style_spec("r"),
            Cell::new(&config.pair.base).style_spec("r"),
            Cell::new(&format!("{}", metric_value)).style_spec("r"),
        ]));
    }

    info!("\nEthereum Gas Info Results:");
    table.printstd();
}
