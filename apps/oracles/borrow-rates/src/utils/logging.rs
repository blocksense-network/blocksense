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
                Cell::new(format!("{:?}", marketplace).as_str()),
                Cell::new(info.asset.as_str()),
                Cell::new(&underlying_asset),
                Cell::new(&format!("{:.2}%", info.borrow_rate * 100.0)),
            ]));
        }
    }

    table.printstd();
}

pub fn print_payload(payload: &Payload, resources: &[FeedConfig]) {
    //Sort feeds from resources based on feed_id
    let sorted_feeds: Vec<&FeedConfig> = resources
        .iter()
        .sorted_by_key(|feed| feed.feed_id)
        .collect();

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);
    table.set_titles(Row::new(vec![
        Cell::new("Feed ID"),
        Cell::new("Feed Name"),
        Cell::new("Value"),
    ]));

    for feed in sorted_feeds {
        let value = payload
            .values
            .iter()
            .find(|v| v.id == feed.feed_id.to_string());
        let display_value = match value {
            Some(v) => format!("{:?}", v.value),
            None => "No Data".to_string(),
        };

        table.add_row(Row::new(vec![
            Cell::new(feed.feed_id.to_string().as_str()),
            Cell::new(
                format!(
                    "{} Borrow Rate on {:?}",
                    feed.pair.base,
                    feed.arguments.as_ref()
                )
                .as_str(),
            ),
            Cell::new(&display_value),
        ]));
    }

    table.printstd();
}
