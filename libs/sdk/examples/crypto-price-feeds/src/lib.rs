use anyhow::{Result, Context};
// use async_trait::async_trait;
use blocksense_sdk::{
    // oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle::{Payload, Settings},
    // price_pair::{DataProvider, OraclePriceHelper},
    oracle_component,
    spin::http::{send, Method, Request, Response},
};
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;
use url::Url;

//TODO(adikov): Refacotr:
//1. Move all specific exchange logic to separate files.
//2. Move URLS to constants
//3. Try to minimize object cloning.
//3. Try to minimize object cloning.

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BinancePrice {
    pub symbol: String,
    pub price: String,
}

async fn get_binance_prices(symbols: Vec<String>) -> Result<HashMap<String, String>> {
    let url = Url::parse(
        "https://api.binance.com/api/v3/ticker/price",
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let values: Vec<BinancePrice> = serde_json::from_str(&string)?;
    let map: HashMap<String, String> = values.into_iter().map(|value| (value.symbol, value.price)).collect();
    let mut result: HashMap<String, String> = HashMap::<String,String>::new();
    //TODO(adikov): We need a proper way to get trade volume from Binance API.
    for symbol in symbols {
        if map.contains_key(&symbol) {
            //TODO(adikov): remove unwrap
            result.insert(symbol.clone(), map.get(&symbol).unwrap().clone());
        }
    }

    Ok(result)
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPrice {
    pub a: Vec<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenResponse {
    pub error: Vec<Value>,
    pub result: HashMap<String, KrakenPrice>,
}

async fn get_kraken_prices(symbols: Vec<String>) -> Result<HashMap<String, String>> {
    let url = Url::parse(
        "https://api.kraken.com/0/public/Ticker",
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: KrakenResponse = serde_json::from_str(&string)?;
    let mut result: HashMap<String, String> = HashMap::<String,String>::new();

    for symbol in symbols {
        if value.result.contains_key(&symbol) {
            //TODO(adikov): remove unwrap
            result.insert(symbol.clone(), value.result.get(&symbol).unwrap().a.first().unwrap().clone());
        }
    }

    Ok(result)
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

async fn get_bybit_prices(symbols: Vec<String>) -> Result<HashMap<String, String>> {
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
    let map: HashMap<String, String> = value.result.list.into_iter().map(|value| (value.symbol, value.last_price)).collect();
    let mut result: HashMap<String, String> = HashMap::<String,String>::new();

    for symbol in symbols {
        if map.contains_key(&symbol) {
            //TODO(adikov): remove unwrap
            result.insert(symbol.clone(), map.get(&symbol).unwrap().clone());
        }
    }

    Ok(result)
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbaseData {
    pub currency: String,
    pub rates: HashMap<String, String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbaseResponse {
    pub data: CoinbaseData,
}

async fn get_coinbase_prices(currency: String) -> Result<HashMap<String, String>> {
    let url = Url::parse_with_params(
        "https://api.coinbase.com/v2/exchange-rates",
        &[("currency", currency)],
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: CoinbaseResponse = serde_json::from_str(&string)?;

    Ok(value.data.rates)
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CmcResource {
    pub cmc_id: String,
    pub cmc_quote: String,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let mut resources: HashMap<String, CmcResource> = HashMap::new();
    let mut binance_quotes: Vec<String> = vec![];
    let mut kraken_quotes: Vec<String> = vec![];
    let mut bybit_quotes: Vec<String> = vec![];
    // let mut ids: Vec<String> = vec![];
    //TODO(adikov): Make sure citrea feeds exist so that we can properly test.
    // let citrea_feeds = vec!["BTCUSD", "ETHUSD", "EURCUSD", "USDTUSD", "USDCUSD", "PAXGUSD", "TBTCUSD", "WBTCUSD", "WSTETHUSD"];
    for feed in settings.data_feeds.iter() {
        let data: CmcResource = serde_json::from_str(&feed.data).context("Couldn't parse Data Feed resource properly")?;
        resources.insert(feed.id.clone(), data.clone());
        //TODO(adikov): We need to get all the proper symbols from the new data feed configuration.
        binance_quotes.push(format!("{}{}", data.cmc_quote, "USDT"));
        kraken_quotes.push(format!("{}{}", data.cmc_quote, "USDT"));
        bybit_quotes.push(format!("{}{}", data.cmc_quote, "USDT"));
    }

    let binance = get_binance_prices(binance_quotes).await?;
    println!("Binance - {:?}", binance);
    let kraken = get_kraken_prices(kraken_quotes).await?;
    println!("Kraken - {:?}", kraken);
    let bybit = get_bybit_prices(bybit_quotes).await?;
    println!("Bybit - {:?}", bybit);
    let coinbase = get_coinbase_prices("USD".to_string()).await?;
    println!("Coinbase - {:?}", coinbase);

    //TODO(adikov): Write the logic for transforming the data to DataFeedResult
    // We need proper way to match binance, kraken, bybit and coinbase response to
    // data feed ID.

    let payload: Payload = Payload::new();
    for (_feed_id, _) in resources.iter() {
        // payload.values.push(match value.data.get(&data.cmc_id.parse::<u64>()?) {
        //     Some(cmc) => {
        //         let value = if let Some(&CmcValue { price }) = cmc.quote.get("USD") {
        //             DataFeedResultValue::Numerical(price)
        //         } else {
        //             DataFeedResultValue::Error(format!(
        //                 "No price in USD for data feed with id {}",
        //                 data.cmc_id
        //             ))
        //         };

        //         DataFeedResult {
        //             id: feed_id.clone(),
        //             value,
        //         }
        //     }
        //     None => {
        //         let error = if value.status.error_code == 0 {
        //                 format!("CMC data feed with id {} is not found", data.cmc_id)
        //             } else {
        //                 println!("CMC returned error with code = {} message = {}", value.status.error_code, value.status.error_message);
        //                 value.status.error_message.to_string()
        //             };
        //         DataFeedResult {
        //             id: feed_id.clone(),
        //             value: DataFeedResultValue::Error(error),
        //         }
        //     }
        // });
    }

    Ok(payload)
}
