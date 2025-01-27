mod binance;
mod common;

use anyhow::{bail, Context, Result};
// use async_trait::async_trait;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    // price_pair::{DataProvider, OraclePriceHelper},
    oracle_component,
    spin::http::{send, Method, Request, Response},
};
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;
use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};
use binance::get_binance_prices;

//TODO(adikov): Refacotr:
//1. Move all specific exchange logic to separate files.
//2. Move URLS to constants
//3. Try to minimize object cloning.

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPrice {
    pub a: Vec<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenResponse {
    pub error: Vec<Value>,
    pub result: HashMap<String, KrakenPrice>,
}

async fn get_kraken_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse("https://api.kraken.com/0/public/Ticker")?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: KrakenResponse = serde_json::from_str(&string)?;
    let mut response: HashMap<String, String> = HashMap::new();
    for (symbol, price) in value.result {
        response.insert(
            symbol.clone(),
            price
                .a
                .first()
                .context(format!(
                    "Kraken has no price in response for symbol: {}",
                    symbol
                ))?
                .clone(),
        );
    }

    fill_results(resources, results, response)?;

    Ok(())
}

//TODO(adikov): Include all the needed fields form the response like volume.
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitPrice {
    pub symbol: String,
    pub last_price: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BybitResult {
    pub category: String,
    pub list: Vec<BybitPrice>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitResponse {
    pub ret_code: u32,
    pub ret_msg: String,
    pub result: BybitResult,
}

async fn get_bybit_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse_with_params(
        "https://api.bybit.com/v5/market/tickers",
        &[("category", "spot"), ("symbols", "")],
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: BybitResponse = serde_json::from_str(&string)?;
    let response: HashMap<String, String> = value
        .result
        .list
        .into_iter()
        .map(|value| (value.symbol, value.last_price))
        .collect();

    fill_results(resources, results, response)?;

    Ok(())
}

// #[derive(Default, Debug, Clone, PartialEq, Deserialize)]
// pub struct CoinbaseData {
//     pub currency: String,
//     pub rates: HashMap<String, String>,
// }

// #[derive(Default, Debug, Clone, PartialEq, Deserialize)]
// pub struct CoinbaseResponse {
//     pub data: CoinbaseData,
// }

// async fn get_coinbase_prices(resources: &Vec<ResourceData>, results: &mut HashMap<String, Vec<ResourceResult>>) -> Result<()> {
//     let url = Url::parse_with_params(
//         "https://api.coinbase.com/v2/exchange-rates",
//         &[("currency", "USD")],
//     )?;

//     let mut req = Request::builder();
//     req.method(Method::Get);
//     req.uri(url);
//     req.header("Accepts", "application/json");

//     let req = req.build();
//     let resp: Response = send(req).await?;

//     let body = resp.into_body();
//     let string = String::from_utf8(body)?;
//     let value: CoinbaseResponse = serde_json::from_str(&string)?;

//     for resource in resources {
//         if value.data.rates.contains_key(&resource.symbol) {
//             //TODO(adikov): remove unwrap
//             let res = results.entry(resource.id.clone()).or_insert(vec![]);
//             res.push(ResourceResult {
//                 id: resource.id.clone(),
//                 symbol: resource.symbol.clone(),
//                 usd_symbol: resource.symbol.to_string(),
//                 result: value.data.rates.get(&resource.symbol).unwrap().clone(),
//             });
//         }
//     }

//     Ok(())
// }

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CmcResource {
    pub cmc_id: String,
    pub cmc_quote: String,
}

fn vwap(results: &Vec<ResourceResult>) -> Result<f64> {
    if results.is_empty() {
        bail!("Missing results");
    }

    //TODO(adikov): Implement vwap logic here.
    // Assume a five-minute chart. The calculation is the same regardless of what intraday time frame is used.
    // 1. Find the average price the stock traded at over the first five-minute period of the day.
    //    To do this, add the high, low, and close, then divide by three.
    //    Multiply this by the volume for that period. Record the result in a spreadsheet, under column PV (price, volume).
    // 2. Divide PV by the volume for that period. This will produce the VWAP.
    // 3. To maintain the VWAP throughout the day, continue to add the PV value from each period to the prior values.
    //    Divide this total by the total volume up to that point.
    //
    //   THIS IS NOT THE PROPER IMPLEMENTATION IT IS FOR TEST PURPOSES
    let mut sum: f64 = 0.0f64;
    for res in results {
        sum += res.result.parse::<f64>()?;
    }

    Ok(sum / results.len() as f64)
}

fn process_results(results: HashMap<String, Vec<ResourceResult>>) -> Result<Payload> {
    let mut payload: Payload = Payload::new();
    for (feed_id, results) in results.iter() {
        payload.values.push(match vwap(results) {
            Ok(price) => DataFeedResult {
                id: feed_id.clone(),
                value: DataFeedResultValue::Numerical(price),
            },
            Err(err) => DataFeedResult {
                id: feed_id.clone(),
                value: DataFeedResultValue::Error(err.to_string()),
            },
        });
    }

    Ok(payload)
}

fn print_results(resources: &Vec<ResourceData>, results: &HashMap<String, Vec<ResourceResult>>) {
    let mut missing = "[".to_string();
    for res in resources {
        if !results.contains_key(&res.id) {
            missing.push_str(&format!("({}-{}),", res.id, res.symbol).to_string());
        }
    }
    println!("missing ids(id-symbol): {}]", missing);

    let mut print = "[".to_string();
    for (id, results) in results {
        print.push_str(&format!("({}-{}),", id, results.len()).to_string());
    }
    println!("(id-echange_count): {}]", print);
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let mut resources: Vec<ResourceData> = vec![];
    let mut results: HashMap<String, Vec<ResourceResult>> =
        HashMap::<String, Vec<ResourceResult>>::new();
    // let mut ids: Vec<String> = vec![];
    //TODO(adikov): Make sure citrea feeds exist so that we can properly test.
    // let citrea_feeds = vec!["BTCUSD", "ETHUSD", "EURCUSD", "USDTUSD", "USDCUSD", "PAXGUSD", "TBTCUSD", "WBTCUSD", "WSTETHUSD"];
    for feed in settings.data_feeds.iter() {
        let data: CmcResource = serde_json::from_str(&feed.data)
            .context("Couldn't parse Data Feed resource properly")?;
        resources.push(ResourceData {
            symbol: data.cmc_quote.clone(),
            id: feed.id.clone(),
        });
        //TODO(adikov): We need to get all the proper symbols from the new data feed configuration.
    }

    get_binance_prices(&resources, &mut results).await?;
    print_results(&resources, &results);

    get_kraken_prices(&resources, &mut results).await?;
    print_results(&resources, &results);

    get_bybit_prices(&resources, &mut results).await?;
    print_results(&resources, &results);

    //TODO(adikov): Transform coinbase price to match the others - 1 / coinbase price
    // get_coinbase_prices(&resources, &mut results).await?;
    // print_results(&resources, &results);

    //TODO(adikov): Write the logic for transforming the data to DataFeedResult
    // We need proper way to match binance, kraken, bybit and coinbase response to
    // data feed ID.

    let payload = process_results(results)?;
    println!("Final Payload - {:?}", payload);

    Ok(payload)
}
