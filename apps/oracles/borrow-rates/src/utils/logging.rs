use blocksense_sdk::oracle::Payload;
use itertools::Itertools;
use prettytable::{format, Cell, Row, Table};

use crate::domain::{FeedConfig, RatesPerFeedPerMarket};

pub fn print_marketplace_data(borrow_rates_per_marketplace: &RatesPerFeedPerMarket) {
    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);
    table.set_titles(Row::new(vec![
        Cell::new("Marketplace"),
        Cell::new("Symbol"),
        Cell::new("Underlying Asset"),
        Cell::new("Variable Borrow Rate (APR)"),
    ]));

    for (marketplace, borrow_rates) in borrow_rates_per_marketplace {
        for (_, info) in borrow_rates {
            let underlying_asset = match info.underlying_asset {
                Some(addr) => addr.to_string(),
                None => "N/A".to_string(),
            };
            table.add_row(Row::new(vec![
                Cell::new(format!("{:?}", marketplace.as_ref()).as_str()),
                Cell::new(info.asset.as_str()),
                Cell::new(&underlying_asset),
                Cell::new(&format!("{:.2}%", info.borrow_rate * 100.0)),
            ]));
        }
    }

    table.printstd();
}

pub fn print_payload(payload: &Payload, resources: &[FeedConfig]) {
    print_generic_payload(payload, resources, "Feed Name");
}
