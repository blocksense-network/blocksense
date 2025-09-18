use blocksense_sdk::oracle::{
    logging::{print_oracle_results, LoggingConfig, ResourceLogEntry},
    Payload,
};
use itertools::zip;
use prettytable::{format, Cell, Row, Table};
use tracing::info;
use std::collections::HashMap;

use crate::{FeedConfig, FeedId, FetchedDataForFeed};

impl ResourceLogEntry for FeedConfig {
    fn get_id_str(&self) -> String {
        self.feed_id.to_string()
    }
    fn get_display_name(&self) -> String {
        format!("{} / {}", self.pair.base, self.pair.quote)
    }
}

pub type FetchedDataHashMap = HashMap<FeedId, FetchedDataForFeed>;

pub fn print_responses(results: &FetchedDataHashMap) {
    let mut feed_ids = results.keys().cloned().collect::<Vec<FeedId>>();
    feed_ids.sort();

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    table.set_titles(Row::new(vec![
        Cell::new("Feed ID").style_spec("bc"),
        Cell::new("Label").style_spec("bc"),
        Cell::new("Method").style_spec("bc"),
        Cell::new("Raw response").style_spec("bc"),
        Cell::new("RPC Url").style_spec("bc"),
        Cell::new("Contract").style_spec("bc"),
    ]));

    for feed_id in feed_ids {
        let res = results.get(&feed_id).unwrap();
        for (resp, contact) in zip(&res.responses, &res.contacts) {
            let rpc_url = format!("{:?}", resp.rpc_url.clone());
            let value = format!("{:?}", resp.result_as_f64());
            table.add_row(Row::new(vec![
                Cell::new(&feed_id.to_string()).style_spec("r"),
                Cell::new(&contact.label).style_spec("l"),
                Cell::new(&contact.method_name).style_spec("r"),
                Cell::new(&value).style_spec("r"),
                Cell::new(&rpc_url).style_spec("r"),
                Cell::new(&contact.address.to_string()).style_spec("r"),
            ]));
        }
    }

    info!(
        "\nResponses:\n{}",
        table.to_string().replace("\r\n", "\n")
    );
}

pub fn print_payload(payload: &Payload, resources: &[FeedConfig]) {
    print_oracle_results(resources, payload, LoggingConfig::basic());
}

pub fn print_results(results: &FetchedDataHashMap, payload: &Payload, resources: &[FeedConfig]) {
    print_responses(results);
    print_payload(payload, resources);
}
