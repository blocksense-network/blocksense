use std::collections::HashMap;

use anyhow::{Context, Result};
use blocksense_sdk::http::http_get_json;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};

use prettytable::{format, Cell, Row, Table};
use serde::{Deserialize, Serialize};
use serde_this_or_that::as_f64;
use std::time::Instant;
use tracing::{info, warn};

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct PoolAttributes {
    pub address: String,
    pub name: String,
    pub volume_usd: VolumeUSD,
    #[serde(deserialize_with = "as_f64")]
    pub base_token_price_usd: f64,
    #[serde(deserialize_with = "as_f64")]
    pub base_token_price_native_currency: f64,
    #[serde(deserialize_with = "as_f64")]
    pub quote_token_price_usd: f64,
    #[serde(deserialize_with = "as_f64")]
    pub quote_token_price_native_currency: f64,
    #[serde(deserialize_with = "as_f64")]
    pub base_token_price_quote_token: f64,
    #[serde(deserialize_with = "as_f64")]
    pub quote_token_price_base_token: f64,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct VolumeUSD {
    #[serde(deserialize_with = "as_f64")]
    pub m5: f64,
    #[serde(deserialize_with = "as_f64")]
    pub m15: f64,
    #[serde(deserialize_with = "as_f64")]
    pub m30: f64,
    #[serde(deserialize_with = "as_f64")]
    pub h1: f64,
    #[serde(deserialize_with = "as_f64")]
    pub h6: f64,
    #[serde(deserialize_with = "as_f64")]
    pub h24: f64,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct ResponseData {
    #[serde(default)]
    pub feed_id: String,
    #[serde(default)]
    pub network: String,
    pub attributes: PoolAttributes,
    #[serde(default)]
    pub reverse: bool,
    #[serde(default)]
    pub min_volume_usd: Option<f64>,
    #[serde(default)]
    pub pool: String,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct GeckoTerminalResponce {
    pub data: ResponseData,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct GeckoTerminalMultipleResponce {
    pub data: Vec<ResponseData>,
}

type GeckoTerminalDataForFeed = HashMap<String, Vec<ResponseData>>;

impl ResponseData {
    pub fn get_price(&self) -> f64 {
        if self.reverse {
            self.attributes.quote_token_price_usd
        } else {
            self.attributes.base_token_price_usd
        }
    }
    pub fn check_volume_usd(&self) -> bool {
        if let Some(v) = self.min_volume_usd {
            self.attributes.volume_usd.h24 > v
        } else {
            true
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GeckoTerminalFeedConfig {
    #[serde(default)]
    pub feed_id: String,
    pub network: String,
    pub pool: String,
    pub reverse: bool,
    #[serde(default)]
    pub min_volume_usd: Option<f64>,
}

async fn fetch_pools_data_for_network(
    network: &str,
    pools: &[GeckoTerminalFeedConfig],
    timeout_secs: u64,
) -> Result<GeckoTerminalMultipleResponce> {
    let r = pools
        .iter()
        .map(|p| p.pool.clone())
        .collect::<Vec<_>>()
        .join(",");
    let url = format!("https://api.geckoterminal.com/api/v2/networks/{network}/pools/multi/{r}");

    let mut value = http_get_json::<GeckoTerminalMultipleResponce>(&url, None, None, Some(timeout_secs)).await?;
    for v in value.data.iter_mut() {
        if let Some(p) = pools
            .iter()
            .find(|p| p.pool.to_uppercase() == v.attributes.address.to_uppercase())
        {
            v.reverse = p.reverse;
            v.feed_id = p.feed_id.clone();
            v.network = network.to_string();
            v.min_volume_usd = p.min_volume_usd;
            v.pool = p.pool.clone();
        }
    }
    Ok(value)
}

async fn fetch_all_prices(resources: &Vec<FeedConfig>, timeout_secs: u64) -> Result<GeckoTerminalDataForFeed> {
    let pools_by_network = group_pools_by_network(resources);

    let before_fetch = Instant::now();
    let mut res = GeckoTerminalDataForFeed::new();
    for network in pools_by_network.keys() {
        if let Some(pools) = pools_by_network.get(network) {
            for pools in pools.chunks(50) {
                let response = fetch_pools_data_for_network(network, pools, timeout_secs).await;
                let pools_addresses = pools
                  .iter()
                  .map(|x| x.pool.to_string())
                  .collect::<Vec<String>>()
                  .join(",");

                match response {
                    Ok(re) => {
                        for d in re.data {
                            res.entry(d.feed_id.clone()).or_default().push(d);
                        }
                        info!("ℹ️ Successfully fetched prices from network for {network}. Pools {pools_addresses}");
                    }
                    Err(err) => {
                        warn!("❌ Error fetching prices from network for {network}: {err:?}. Pools {pools_addresses}");
                    }
                };
            }
        }
    }

    info!("🕛 All prices fetched in {:?}", before_fetch.elapsed());
    Ok(res)
}

fn group_pools_by_network(
    resources: &Vec<FeedConfig>,
) -> HashMap<String, Vec<GeckoTerminalFeedConfig>> {
    let mut pools_by_network: HashMap<String, Vec<GeckoTerminalFeedConfig>> = HashMap::new();
    for config in resources {
        for pool in &config.arguments {
            let new_pool = {
                let mut cloned_pool = pool.clone();
                cloned_pool.feed_id = config.id.clone();
                cloned_pool
            };
            pools_by_network
                .entry(pool.network.clone())
                .or_default()
                .push(new_pool);
        }
    }
    pools_by_network
}
fn process_results(reponses: &GeckoTerminalDataForFeed) -> Result<Payload> {
    let mut payload: Payload = Payload::new();
    for (id, vec_data) in reponses.iter() {
        let mut total: f64 = 0.0f64;
        let mut total_weight: f64 = 0.0f64;
        let mut total_weighted_price: f64 = 0.0f64;
        let mut count: i32 = 0;
        for data in vec_data {
            if data.check_volume_usd() {
                let price = data.get_price();
                let weight = data.attributes.volume_usd.h24;
                total += price;
                total_weighted_price += price * weight;
                total_weight += weight;
                count += 1;
            }
        }
        if count > 0 {
            let price = if count == 1 {
                total
            } else {
                total_weighted_price / total_weight
            };
            payload.values.push(DataFeedResult {
                id: id.clone(),
                value: DataFeedResultValue::Numerical(price),
            });
        } else {
            payload.values.push(DataFeedResult {
                id: id.clone(),
                value: DataFeedResultValue::Error(
                    "Not enough volume to reliably average prices".to_string(),
                ),
            });
        }
    }
    Ok(payload)
}

fn print_responses(reponses: &GeckoTerminalDataForFeed) {
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
    let mut feed_ids = reponses.keys().cloned().collect::<Vec<String>>();
    feed_ids.sort();
    for feed_id in feed_ids {
        if let Some(data) = reponses.get(&feed_id) {
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
    table.printstd();
}

fn print_results(
    resources: &[FeedConfig],
    responses: &GeckoTerminalDataForFeed,
    payload: &Payload,
) {
    print_responses(responses);

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    table.set_titles(Row::new(vec![
        Cell::new("Feed ID").style_spec("bc"),
        Cell::new("Name").style_spec("bc"),
        Cell::new("Value").style_spec("bc"),
        Cell::new("Used Pools").style_spec("bc"),
    ]));

    let mut feed_ids = responses.keys().cloned().collect::<Vec<String>>();
    feed_ids.sort();
    for feed_id in feed_ids {
        let name = if let Some(resourse) = resources.iter().find(|x| x.id == feed_id) {
            format!("{}/{}", resourse.pair.base, resourse.pair.quote)
        } else {
            "No name".to_string()
        };
        let num_pools = if let Some(feed_id_responses) = responses.get(&feed_id) {
            feed_id_responses
                .iter()
                .filter(|x| x.check_volume_usd())
                .count()
                .to_string()
        } else {
            "No response".to_string()
        };
        if let Some(result) = payload.values.iter().find(|x| x.id == *feed_id) {
            let value = format!("{:?}", result.value);
            table.add_row(Row::new(vec![
                Cell::new(&feed_id.to_string()).style_spec("r"),
                Cell::new(&name).style_spec("l"),
                Cell::new(&value).style_spec("r"),
                Cell::new(&num_pools).style_spec("r"),
            ]));
        }
    }
    table.printstd();
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();

    info!("Starting oracle component - Gecko Terminal");
    let resources = get_resources_from_settings(&settings)?;
    let timeout_secs = settings.interval_time_in_seconds - 1;
    let results = fetch_all_prices(&resources, timeout_secs).await?;
    let payload = process_results(&results)?;
    print_results(&resources, &results, &payload);
    Ok(payload)
}

#[derive(Deserialize, Debug)]
pub struct GeckoTerminalFeedConfigSettings {
  pub settings: Vec<GeckoTerminalFeedConfig>,
}
#[derive(Deserialize, Debug)]
struct FeedArgumentsVec {
    pub pair: Pair,
    pub arguments: GeckoTerminalFeedConfigSettings,
}

#[derive(Deserialize, Debug)]
pub struct Pair {
    pub base: String,
    pub quote: String,
}

#[derive(Deserialize, Debug)]
struct FeedConfig {
    pub id: String,
    pub arguments: Vec<GeckoTerminalFeedConfig>,
    pub pair: Pair,
}

fn get_resources_from_settings(settings: &Settings) -> Result<Vec<FeedConfig>> {
    let mut config: Vec<FeedConfig> = Vec::new();
    for feed_setting in &settings.data_feeds {
            let feed_config = serde_json::from_str::<FeedArgumentsVec>(&feed_setting.data)
                .context("Couldn't parse data feed")?;
            let c = FeedConfig {
                id: feed_setting.id.clone(),
                arguments: feed_config.arguments.settings,
                pair: feed_config.pair,
            };
            config.push(c);
    }
    Ok(config)
}

#[cfg(test)]
mod tests {
    use crate::GeckoTerminalMultipleResponce;
    #[test]
    fn test_parsing_responce() {
        let raw = r#"{
            "data": [
              {
                "id": "monad-testnet_0xc0ce32eee0eb8bf24fa2b00923a78abc5002f91e",
                "type": "pool",
                "attributes": {
                  "base_token_price_usd": "0.163828268957235",
                  "base_token_price_native_currency": "0.0168950585423778",
                  "quote_token_price_usd": "9.66558346381163",
                  "quote_token_price_native_currency": "1.0",
                  "base_token_price_quote_token": "0.01689505854",
                  "quote_token_price_base_token": "59.18890411",
                  "address": "0xc0ce32eee0eb8bf24fa2b00923a78abc5002f91e",
                  "name": "CHOG / WMON",
                  "pool_created_at": "2025-02-20T11:23:16Z",
                  "fdv_usd": "16382826.3675859",
                  "market_cap_usd": null,
                  "price_change_percentage": {
                    "m5": "0.15",
                    "m15": "0.52",
                    "m30": "0.29",
                    "h1": "0.63",
                    "h6": "2.41",
                    "h24": "1.98"
                  },
                  "transactions": {
                    "m5": {
                      "buys": 142,
                      "sells": 23,
                      "buyers": 136,
                      "sellers": 23
                    },
                    "m15": {
                      "buys": 683,
                      "sells": 102,
                      "buyers": 632,
                      "sellers": 97
                    },
                    "m30": {
                      "buys": 1525,
                      "sells": 219,
                      "buyers": 1396,
                      "sellers": 207
                    },
                    "h1": {
                      "buys": 3224,
                      "sells": 457,
                      "buyers": 2830,
                      "sellers": 431
                    },
                    "h6": {
                      "buys": 22485,
                      "sells": 2917,
                      "buyers": 19351,
                      "sellers": 2702
                    },
                    "h24": {
                      "buys": 77796,
                      "sells": 11782,
                      "buyers": 65320,
                      "sellers": 10675
                    }
                  },
                  "volume_usd": {
                    "m5": "739.6638222092",
                    "m15": "3496.6135005593",
                    "m30": "7858.6964603576",
                    "h1": "12176.9104960931",
                    "h6": "74981.9754459174",
                    "h24": "230090.703679488"
                  },
                  "reserve_in_usd": "1922839.6737",
                  "locked_liquidity_percentage": null
                },
                "relationships": {
                  "base_token": {
                    "data": {
                      "id": "monad-testnet_0xe0590015a873bf326bd645c3e1266d4db41c4e6b",
                      "type": "token"
                    }
                  },
                  "quote_token": {
                    "data": {
                      "id": "monad-testnet_0x760afe86e5de5fa0ee542fc7b7b713e1c5425701",
                      "type": "token"
                    }
                  },
                  "dex": {
                    "data": {
                      "id": "uniswap-v2-monad-testnet",
                      "type": "dex"
                    }
                  }
                }
              },
              {
                "id": "monad-testnet_0x786f4aa162457ecdf8fa4657759fa3e86c9394ff",
                "type": "pool",
                "attributes": {
                  "base_token_price_usd": "0.0972828246071439",
                  "base_token_price_native_currency": "0.0100974932259467",
                  "quote_token_price_usd": "9.66558346381163",
                  "quote_token_price_native_currency": "1.0",
                  "base_token_price_quote_token": "0.01009749323",
                  "quote_token_price_base_token": "99.034480898",
                  "address": "0x786f4aa162457ecdf8fa4657759fa3e86c9394ff",
                  "name": "MAD / WMON",
                  "pool_created_at": "2025-03-25T08:27:43Z",
                  "fdv_usd": "19456564.9214288",
                  "market_cap_usd": null,
                  "price_change_percentage": {
                    "m5": "0.21",
                    "m15": "-1.21",
                    "m30": "-1.25",
                    "h1": "-1.04",
                    "h6": "0.1",
                    "h24": "2.99"
                  },
                  "transactions": {
                    "m5": {
                      "buys": 63,
                      "sells": 36,
                      "buyers": 62,
                      "sellers": 36
                    },
                    "m15": {
                      "buys": 412,
                      "sells": 288,
                      "buyers": 385,
                      "sellers": 284
                    },
                    "m30": {
                      "buys": 927,
                      "sells": 705,
                      "buyers": 873,
                      "sellers": 680
                    },
                    "h1": {
                      "buys": 2094,
                      "sells": 1573,
                      "buyers": 1921,
                      "sellers": 1454
                    },
                    "h6": {
                      "buys": 16405,
                      "sells": 8271,
                      "buyers": 14991,
                      "sellers": 7575
                    },
                    "h24": {
                      "buys": 52172,
                      "sells": 25300,
                      "buyers": 43184,
                      "sellers": 20155
                    }
                  },
                  "volume_usd": {
                    "m5": "1422.4554366557",
                    "m15": "11496.5277953363",
                    "m30": "18617.0585445526",
                    "h1": "33859.884755605",
                    "h6": "188757.334947648",
                    "h24": "671102.691301966"
                  },
                  "reserve_in_usd": "677771.1159",
                  "locked_liquidity_percentage": null
                },
                "relationships": {
                  "base_token": {
                    "data": {
                      "id": "monad-testnet_0xc8527e96c3cb9522f6e35e95c0a28feab8144f15",
                      "type": "token"
                    }
                  },
                  "quote_token": {
                    "data": {
                      "id": "monad-testnet_0x760afe86e5de5fa0ee542fc7b7b713e1c5425701",
                      "type": "token"
                    }
                  },
                  "dex": {
                    "data": {
                      "id": "madness-finance",
                      "type": "dex"
                    }
                  }
                }
              },
              {
                "id": "monad-testnet_0xf2afc5aa9965cdb2d4be94823c98411291b61297",
                "type": "pool",
                "attributes": {
                  "base_token_price_usd": "2.04359324869297",
                  "base_token_price_native_currency": "0.210846464198185",
                  "quote_token_price_usd": "9.66558346381163",
                  "quote_token_price_native_currency": "1.0",
                  "base_token_price_quote_token": "0.2108464642",
                  "quote_token_price_base_token": "4.742787619",
                  "address": "0xf2afc5aa9965cdb2d4be94823c98411291b61297",
                  "name": "BEAN / WMON",
                  "pool_created_at": "2025-03-03T09:24:13Z",
                  "fdv_usd": "20435932.4869297",
                  "market_cap_usd": null,
                  "price_change_percentage": {
                    "m5": "-0.56",
                    "m15": "-0.56",
                    "m30": "-0.09",
                    "h1": "-0.51",
                    "h6": "-1.84",
                    "h24": "3.93"
                  },
                  "transactions": {
                    "m5": {
                      "buys": 65,
                      "sells": 36,
                      "buyers": 57,
                      "sellers": 35
                    },
                    "m15": {
                      "buys": 378,
                      "sells": 275,
                      "buyers": 329,
                      "sellers": 233
                    },
                    "m30": {
                      "buys": 805,
                      "sells": 603,
                      "buyers": 709,
                      "sellers": 499
                    },
                    "h1": {
                      "buys": 1719,
                      "sells": 1273,
                      "buyers": 1470,
                      "sellers": 1051
                    },
                    "h6": {
                      "buys": 11277,
                      "sells": 8585,
                      "buyers": 9564,
                      "sellers": 7013
                    },
                    "h24": {
                      "buys": 39639,
                      "sells": 31354,
                      "buyers": 32381,
                      "sellers": 23701
                    }
                  },
                  "volume_usd": {
                    "m5": "469.1485180185",
                    "m15": "3035.4263622067",
                    "m30": "6601.7638933551",
                    "h1": "18009.5587594932",
                    "h6": "120533.38678189",
                    "h24": "418258.18936751"
                  },
                  "reserve_in_usd": "651740.0172",
                  "locked_liquidity_percentage": null
                },
                "relationships": {
                  "base_token": {
                    "data": {
                      "id": "monad-testnet_0x268e4e24e0051ec27b3d27a95977e71ce6875a05",
                      "type": "token"
                    }
                  },
                  "quote_token": {
                    "data": {
                      "id": "monad-testnet_0x760afe86e5de5fa0ee542fc7b7b713e1c5425701",
                      "type": "token"
                    }
                  },
                  "dex": {
                    "data": {
                      "id": "bean-exchange",
                      "type": "dex"
                    }
                  }
                }
              },
              {
                "id": "monad-testnet_0xf22d36b6bee8a7fd51def4e3badf35a8733b284f",
                "type": "pool",
                "attributes": {
                  "base_token_price_usd": "0.998048030025504",
                  "base_token_price_native_currency": "0.103255170822637",
                  "quote_token_price_usd": "9.66558346381163",
                  "quote_token_price_native_currency": "1.0",
                  "base_token_price_quote_token": "0.1032551708",
                  "quote_token_price_base_token": "9.684745006",
                  "address": "0xf22d36b6bee8a7fd51def4e3badf35a8733b284f",
                  "name": "USDC / WMON 0.2%",
                  "pool_created_at": "2025-02-27T07:11:16Z",
                  "fdv_usd": "99809791.5916197",
                  "market_cap_usd": null,
                  "price_change_percentage": {
                    "m5": "0",
                    "m15": "0.2",
                    "m30": "-0.15",
                    "h1": "0.12",
                    "h6": "-0.06",
                    "h24": "-0.83"
                  },
                  "transactions": {
                    "m5": {
                      "buys": 11,
                      "sells": 0,
                      "buyers": 11,
                      "sellers": 0
                    },
                    "m15": {
                      "buys": 86,
                      "sells": 0,
                      "buyers": 86,
                      "sellers": 0
                    },
                    "m30": {
                      "buys": 187,
                      "sells": 4,
                      "buyers": 186,
                      "sellers": 4
                    },
                    "h1": {
                      "buys": 425,
                      "sells": 23,
                      "buyers": 421,
                      "sellers": 23
                    },
                    "h6": {
                      "buys": 2217,
                      "sells": 92,
                      "buyers": 2176,
                      "sellers": 87
                    },
                    "h24": {
                      "buys": 5099,
                      "sells": 388,
                      "buyers": 4981,
                      "sellers": 348
                    }
                  },
                  "volume_usd": {
                    "m5": "0.1637132055",
                    "m15": "96.8330105108",
                    "m30": "769.1949284789",
                    "h1": "1636.7935371706",
                    "h6": "18930.8550704817",
                    "h24": "69105.7469459649"
                  },
                  "reserve_in_usd": "944741.6508",
                  "locked_liquidity_percentage": null
                },
                "relationships": {
                  "base_token": {
                    "data": {
                      "id": "monad-testnet_0xf817257fed379853cde0fa4f97ab987181b1e5ea",
                      "type": "token"
                    }
                  },
                  "quote_token": {
                    "data": {
                      "id": "monad-testnet_0x760afe86e5de5fa0ee542fc7b7b713e1c5425701",
                      "type": "token"
                    }
                  },
                  "dex": {
                    "data": {
                      "id": "iziswap-monad-testnet",
                      "type": "dex"
                    }
                  }
                }
              },
              {
                "id": "monad-testnet_0xe8a806ae6ecb1f02063e21c6f0579b145399ee5f",
                "type": "pool",
                "attributes": {
                  "base_token_price_usd": "0.000272421298758802",
                  "base_token_price_native_currency": "0.000028251230201563",
                  "quote_token_price_usd": "9.66558346381163",
                  "quote_token_price_native_currency": "1.0",
                  "base_token_price_quote_token": "0.0000282512302",
                  "quote_token_price_base_token": "35396.688670381",
                  "address": "0xe8a806ae6ecb1f02063e21c6f0579b145399ee5f",
                  "name": "JAI / WMON",
                  "pool_created_at": "2025-03-03T09:24:01Z",
                  "fdv_usd": "2724212.98758802",
                  "market_cap_usd": null,
                  "price_change_percentage": {
                    "m5": "-0.61",
                    "m15": "0.8",
                    "m30": "0.14",
                    "h1": "-0.33",
                    "h6": "4.57",
                    "h24": "6.35"
                  },
                  "transactions": {
                    "m5": {
                      "buys": 68,
                      "sells": 37,
                      "buyers": 66,
                      "sellers": 35
                    },
                    "m15": {
                      "buys": 385,
                      "sells": 241,
                      "buyers": 333,
                      "sellers": 211
                    },
                    "m30": {
                      "buys": 799,
                      "sells": 508,
                      "buyers": 684,
                      "sellers": 438
                    },
                    "h1": {
                      "buys": 1635,
                      "sells": 1079,
                      "buyers": 1353,
                      "sellers": 899
                    },
                    "h6": {
                      "buys": 10101,
                      "sells": 6549,
                      "buyers": 8400,
                      "sellers": 5341
                    },
                    "h24": {
                      "buys": 32791,
                      "sells": 22685,
                      "buyers": 26648,
                      "sellers": 16887
                    }
                  },
                  "volume_usd": {
                    "m5": "513.6051349287",
                    "m15": "1889.3327488214",
                    "m30": "3778.2071474251",
                    "h1": "9654.7724745484",
                    "h6": "69628.8997032741",
                    "h24": "190282.75040509"
                  },
                  "reserve_in_usd": "298605.8652",
                  "locked_liquidity_percentage": null
                },
                "relationships": {
                  "base_token": {
                    "data": {
                      "id": "monad-testnet_0xcc5b42f9d6144dfdfb6fb3987a2a916af902f5f8",
                      "type": "token"
                    }
                  },
                  "quote_token": {
                    "data": {
                      "id": "monad-testnet_0x760afe86e5de5fa0ee542fc7b7b713e1c5425701",
                      "type": "token"
                    }
                  },
                  "dex": {
                    "data": {
                      "id": "bean-exchange",
                      "type": "dex"
                    }
                  }
                }
              }
            ]
          }"#;
        let value: GeckoTerminalMultipleResponce =
            serde_json::from_str(raw).expect("This should never happen");
        assert_eq!(value.data.len(), 5);
        assert_eq!(
            value.data[0].attributes.volume_usd.h24,
            230090.703679488_f64
        );
        assert_eq!(value.data[0].attributes.name, "CHOG / WMON");
        assert_eq!(
            value.data[0].attributes.quote_token_price_usd,
            9.66558346381163_f64
        );

        assert_eq!(value.data[1].attributes.name, "MAD / WMON");
        assert_eq!(
            value.data[1].attributes.quote_token_price_usd,
            9.66558346381163_f64
        );
        assert_eq!(
            value.data[1].attributes.volume_usd.h24,
            671102.691301966_f64
        );

        assert_eq!(value.data[2].attributes.name, "BEAN / WMON");
        assert_eq!(
            value.data[2].attributes.quote_token_price_usd,
            9.66558346381163_f64
        );
        assert_eq!(value.data[2].attributes.volume_usd.h24, 418258.18936751_f64);

        assert_eq!(value.data[3].attributes.name, "USDC / WMON 0.2%");
        assert_eq!(
            value.data[3].attributes.quote_token_price_usd,
            9.66558346381163_f64
        );
        assert_eq!(
            value.data[3].attributes.volume_usd.h24,
            69105.7469459649_f64
        );

        assert_eq!(value.data[4].attributes.name, "JAI / WMON");
        assert_eq!(
            value.data[4].attributes.quote_token_price_usd,
            9.66558346381163_f64
        );
        assert_eq!(value.data[4].attributes.volume_usd.h24, 190282.75040509_f64);
    }
    #[test]
    fn test_parsing_responce2() {
        let raw = r#"{
        "data": [
          {
            "id": "base_0xd3ee0a3b349237d68517df30bfb66be971f46ad9",
            "type": "pool",
            "attributes": {
              "base_token_price_usd": "0.997490689159406",
              "base_token_price_native_currency": "0.000632854458009392",
              "quote_token_price_usd": "0.998787044324444",
              "quote_token_price_native_currency": "0.00063405388659788",
              "base_token_price_quote_token": "0.9981083176",
              "quote_token_price_base_token": "1.0018952677",
              "address": "0xd3ee0a3b349237d68517df30bfb66be971f46ad9",
              "name": "USR / USDC",
              "pool_created_at": "2024-12-02T22:34:37Z",
              "fdv_usd": "144973204.632112",
              "market_cap_usd": null,
              "price_change_percentage": {
                "m5": "0",
                "m15": "0.06",
                "m30": "-0.09",
                "h1": "-0.05",
                "h6": "-0.22",
                "h24": "0.47"
              },
              "transactions": {
                "m5": {
                  "buys": 0,
                  "sells": 0,
                  "buyers": 0,
                  "sellers": 0
                },
                "m15": {
                  "buys": 2,
                  "sells": 0,
                  "buyers": 2,
                  "sellers": 0
                },
                "m30": {
                  "buys": 3,
                  "sells": 3,
                  "buyers": 3,
                  "sellers": 2
                },
                "h1": {
                  "buys": 20,
                  "sells": 6,
                  "buyers": 8,
                  "sellers": 5
                },
                "h6": {
                  "buys": 23,
                  "sells": 24,
                  "buyers": 11,
                  "sellers": 21
                },
                "h24": {
                  "buys": 49,
                  "sells": 85,
                  "buyers": 31,
                  "sellers": 68
                }
              },
              "volume_usd": {
                "m5": "0.0",
                "m15": "5341.1193886335",
                "m30": "6237.4529742006",
                "h1": "123860.982100642",
                "h6": "148433.641050373",
                "h24": "210526.004942701"
              },
              "reserve_in_usd": "3392810.9864",
              "locked_liquidity_percentage": null
            },
            "relationships": {
              "base_token": {
                "data": {
                  "id": "base_0x35e5db674d8e93a03d814fa0ada70731efe8a4b9",
                  "type": "token"
                }
              },
              "quote_token": {
                "data": {
                  "id": "base_0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                  "type": "token"
                }
              },
              "dex": {
                "data": {
                  "id": "aerodrome-base",
                  "type": "dex"
                }
              }
            }
          },
          {
            "id": "base_0xb924561a57fc60041414b8471cbc99d3497097fa",
            "type": "pool",
            "attributes": {
              "base_token_price_usd": "1.00244546610649",
              "base_token_price_native_currency": "0.000638561305925082330775418713143738184617765790084025952771880425794618593714181536695755847559027949859320808534079832978953784783334219422790840561637754665609314017111333100834555600394379500334700225792233833307826491619428603601518251226221771170345560754060429714593718891488560444271960565278243646885132330496944089456438767015705478136268576948153686135601909269118815897086005710310649101811160895904113135274537560227584716357122710243795066046366788052442814641284853729799888505713662838340479402208940109758309452148946805383687314228509488124102463834324264137269323032787452495160606133842808898755332890688321848151292996462763295319523124748349232655583936087226228104619438905190422786496263882345028426668946587373679703487275720987029142651054975480173353188778139135049654203712942804897944218259781279458236563921704688709310450503747166546250447295927230500246652158358450427881421559119663501199909172607038456707096317859849275704370800883810029620403025179519662729299126892634278172820099309297972780099836737795831717750829300450535238318410265849907179244168181679746200812635117434128434429820397285887422259043686669695239388373012941672986104443438507295614123153501545645570688364078675404453321350641808549256186071713563396529304912017259298135123592042847764725057568438757559097451650715596182158027100346370749640621569391490382004559030044528565868524819618313272402396575092965654",
              "quote_token_price_usd": "1.00802432126983",
              "quote_token_price_native_currency": "0.000642115056387444",
              "base_token_price_quote_token": "0.994465555",
              "quote_token_price_base_token": "1.0055652455",
              "address": "0xb924561a57fc60041414b8471cbc99d3497097fa",
              "name": "USR / GYD 0.01%",
              "pool_created_at": "2025-02-24T01:22:27Z",
              "fdv_usd": "145693321.521485",
              "market_cap_usd": null,
              "price_change_percentage": {
                "m5": "0",
                "m15": "0",
                "m30": "0",
                "h1": "-0.55",
                "h6": "0.33",
                "h24": "-0.12"
              },
              "transactions": {
                "m5": {
                  "buys": 0,
                  "sells": 0,
                  "buyers": 0,
                  "sellers": 0
                },
                "m15": {
                  "buys": 0,
                  "sells": 0,
                  "buyers": 0,
                  "sellers": 0
                },
                "m30": {
                  "buys": 0,
                  "sells": 0,
                  "buyers": 0,
                  "sellers": 0
                },
                "h1": {
                  "buys": 0,
                  "sells": 11,
                  "buyers": 0,
                  "sellers": 5
                },
                "h6": {
                  "buys": 0,
                  "sells": 29,
                  "buyers": 0,
                  "sellers": 8
                },
                "h24": {
                  "buys": 3,
                  "sells": 53,
                  "buyers": 3,
                  "sellers": 10
                }
              },
              "volume_usd": {
                "m5": "0.0",
                "m15": "0.0",
                "m30": "0.0",
                "h1": "52587.2311650526",
                "h6": "80711.4249267678",
                "h24": "112969.273817945"
              },
              "reserve_in_usd": "150263.1042",
              "locked_liquidity_percentage": null
            },
            "relationships": {
              "base_token": {
                "data": {
                  "id": "base_0x35e5db674d8e93a03d814fa0ada70731efe8a4b9",
                  "type": "token"
                }
              },
              "quote_token": {
                "data": {
                  "id": "base_0xca5d8f8a8d49439357d3cf46ca2e720702f132b8",
                  "type": "token"
                }
              },
              "dex": {
                "data": {
                  "id": "balancer-v2-base",
                  "type": "dex"
                }
              }
            }
          },
          {
            "id": "base_0x97c9750305a39e06002edd851f3d37a862ac7060",
            "type": "pool",
            "attributes": {
              "base_token_price_usd": "1.00709295457369",
              "base_token_price_native_currency": "0.0006328541735874420458786112741188022282694091137612199079829207559642391225928911146062088086661629463406547926380158977335562593485335063864482938660201715656129851686969550476096314663313695317509472711620475290220802945059294613828426903633693166835521913121911140130370701201916776913866153519435899463952728309037017697666219113171038688955735031697851705354754644066561104755718493822982678403916552097850705647547626902615471106603232040378312443527407868354985818230611191789513341850530077949900534339777352415309737172518880680185913659766815313543095034905744485097159312933150099473502417145821834761485203552323034154048395721499356683243368492412348369197009895308239277155526170550278430876991117359942991376053909890389239666257287310185426046738778551022586835849225123667050602808889776978609824100773686123979531412251653828651237911305715677690675728540635363381534285214197004863394129678113474609060558471296178960465504871736010528492721294381431297040718757791927675807612856384369052902180422540226848726308608950566728664948540258675097114668435155011792882744178294708235064227672227445176608987602501035164237256380182689617376132813383165970380699702973093464324364175292389840339875548100180529102948896239207126195728016666295884845962619560039846815822902084676737088064405367261144098587151888488882226223975995916265182183934984238491476460072198950168123821282951808961168000486170412504",
              "quote_token_price_usd": "1.00863181431767",
              "quote_token_price_native_currency": "0.000641741679010549",
              "base_token_price_quote_token": "0.9861509612",
              "quote_token_price_base_token": "1.0140435282",
              "address": "0x97c9750305a39e06002edd851f3d37a862ac7060",
              "name": "USR / USDC 0.01%",
              "pool_created_at": "2024-12-25T08:51:13Z",
              "fdv_usd": "146368777.747697",
              "market_cap_usd": null,
              "price_change_percentage": {
                "m5": "0",
                "m15": "0.84",
                "m30": "0.88",
                "h1": "0.15",
                "h6": "0.67",
                "h24": "-0.08"
              },
              "transactions": {
                "m5": {
                  "buys": 0,
                  "sells": 1,
                  "buyers": 0,
                  "sellers": 1
                },
                "m15": {
                  "buys": 4,
                  "sells": 4,
                  "buyers": 4,
                  "sellers": 4
                },
                "m30": {
                  "buys": 5,
                  "sells": 4,
                  "buyers": 4,
                  "sellers": 4
                },
                "h1": {
                  "buys": 9,
                  "sells": 10,
                  "buyers": 8,
                  "sellers": 10
                },
                "h6": {
                  "buys": 41,
                  "sells": 52,
                  "buyers": 35,
                  "sellers": 39
                },
                "h24": {
                  "buys": 117,
                  "sells": 207,
                  "buyers": 87,
                  "sellers": 140
                }
              },
              "volume_usd": {
                "m5": "7.0362125108",
                "m15": "16377.1016416017",
                "m30": "16381.18656097",
                "h1": "266095.8935227",
                "h6": "616975.60880721",
                "h24": "1012903.95537022"
              },
              "reserve_in_usd": "505703.2809",
              "locked_liquidity_percentage": null
            },
            "relationships": {
              "base_token": {
                "data": {
                  "id": "base_0x35e5db674d8e93a03d814fa0ada70731efe8a4b9",
                  "type": "token"
                }
              },
              "quote_token": {
                "data": {
                  "id": "base_0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                  "type": "token"
                }
              },
              "dex": {
                "data": {
                  "id": "pancakeswap-v3-base",
                  "type": "dex"
                }
              }
            }
          },
          {
            "id": "base_0xcf88b8bf7ccce2d836878e538197eb20fc673bce",
            "type": "pool",
            "attributes": {
              "base_token_price_usd": "0.987063334395549",
              "base_token_price_native_currency": "0.000625664661078533300867880765991673013377843703361258141558068975160472331702149448974391333802854899002661080058759071442173599855258793265320836223822492610173135843654973101015671832940709410927293073886355986629957063441005522165866484240419290894156039466550356193471474936055193153825480552400823708878259081259158890603811179829764085747022125617253192433411805538632540004855168574911826160798185812229142293551958493375104099615327050334137218053498443124908515097689552508255595690451784893617119810552324030145223015997144886245174019196570640561091365659590229231156560705464875157538561806871547221531125310924841453033670000932262349961092656097005562753737444958309247423593833774012607397101519120073279021117058934601195153109401034223309750507004507139670643551556963626701363877365042715987734241736648269386843926312560467643547168196384951265605338743929763733148529359848012028472169781028699659933515457259958690791042415269972889841242938894875485955062235391065011362689700702042397421383298508382666208213626254672763478255139686521168605986423137767634262778431692107398680016646384617755287386431613324142549791470012490806901953525350060532867984726887715398316127338318416401969418135489018313127204052518300577921297841988779835882477649120344148828784642184238363694312883214650958589931118016056946456753839607995033789191357920616754059502737259130148077698882142590933868916538950105933433082996633582230763556311475922239044594265040611923798253025512482449397314355836671537842465261660070794938698224376056267661184378595157513391256523483817018630503832462984958100980600537150491046154667877818030987440324516741420451714315264119950452605979064928697050478146292752322925651991247826781953340839109954703351516142236797697494953329299774792019792950035658553155296959564348119016431608549095539108243090428200891314413235813508274073181827127028670616204063377782482988422755535122979943129261900246091395968651836493534334577754227775265980070798827767177347705731043291505509903805365293963921910132477073116320318452517165099134923505085214400490178084461128328357383698946582789606621771432134659974171904944894452052231132402108878405451875784389012155182583275084679575328897530920862119184260987016188211200238730393615483788745593339725989897437037806313042089800085429145792208025139586101991277414293479499496902592105667254427854221538094981598380736419589988744728052957800925662901488835925834615596389891606363550555970398945038766065202582885057231786543504673115768823197517842704858192685017717279902239877990125188736847637467489586546097654646492668595830088315995302618725039884896038139988298114364565111314248891413680253118200638920707529453103670325679901310642300359970109220263417547044783093994611812817699832486238371281097999273385045268224874448357913049131661664834105064723171522200631978088539473814364204616590078357440468962342720362734266818327805824074355837740534551007740765266918503114005878517393050290137121778258060608219580831241528933517919872028989791179545503805865027258952901436488057181684731478816337227629959721326031406631103902027463943118844386783382555273940399997058014138502816630500425568312725731946803397308332029789458715441105023769739803235780239466501148772211156321619697240175976651198354370395516414530277544951600803860201506208646649412567211227158470227829425411361095820886047075430858962111253410205324829346843257252094098220946320211937358701307547404197560685894543255292007961299470003396669928420341592192265296323755192226302243652976483704314440588390286029353882735375279506604434430757332366600536152720514921711022820382907215241567291788864031195680500148315823581307703893358945186833015710108063798981707087284254693634892802445918592940672853680631417275307134861471514136001906645035445384334966885189174894209291860814751277149046109289571066769966103023019538008607203331720336524772778797208",
              "quote_token_price_usd": "1570.35",
              "quote_token_price_native_currency": "1.0",
              "base_token_price_quote_token": "0.0006256646611",
              "quote_token_price_base_token": "1598.3002752244",
              "address": "0xcf88b8bf7ccce2d836878e538197eb20fc673bce",
              "name": "USDz / WETH 0.04%",
              "pool_created_at": "2024-07-18T23:50:02Z",
              "fdv_usd": "115609034.747141",
              "market_cap_usd": "124306472.308307",
              "price_change_percentage": {
                "m5": "0.1",
                "m15": "0.59",
                "m30": "0.78",
                "h1": "0.73",
                "h6": "0.62",
                "h24": "2.09"
              },
              "transactions": {
                "m5": {
                  "buys": 4,
                  "sells": 1,
                  "buyers": 4,
                  "sellers": 1
                },
                "m15": {
                  "buys": 12,
                  "sells": 3,
                  "buyers": 11,
                  "sellers": 3
                },
                "m30": {
                  "buys": 25,
                  "sells": 16,
                  "buyers": 16,
                  "sellers": 12
                },
                "h1": {
                  "buys": 55,
                  "sells": 43,
                  "buyers": 35,
                  "sellers": 24
                },
                "h6": {
                  "buys": 162,
                  "sells": 159,
                  "buyers": 62,
                  "sellers": 42
                },
                "h24": {
                  "buys": 658,
                  "sells": 683,
                  "buyers": 172,
                  "sellers": 162
                }
              },
              "volume_usd": {
                "m5": "22.914503934",
                "m15": "75.9913029647",
                "m30": "205.8115131572",
                "h1": "546.5694719221",
                "h6": "1515.7560972564",
                "h24": "7710.7790743691"
              },
              "reserve_in_usd": "16273.0891",
              "locked_liquidity_percentage": null
            },
            "relationships": {
              "base_token": {
                "data": {
                  "id": "base_0x04d5ddf5f3a8939889f11e97f8c4bb48317f1938",
                  "type": "token"
                }
              },
              "quote_token": {
                "data": {
                  "id": "base_0x4200000000000000000000000000000000000006",
                  "type": "token"
                }
              },
              "dex": {
                "data": {
                  "id": "aerodrome-slipstream",
                  "type": "dex"
                }
              }
            }
          },
          {
            "id": "base_0x6d0b9c9e92a3de30081563c3657b5258b3ffa38b",
            "type": "pool",
            "attributes": {
              "base_token_price_usd": "0.977116821708074",
              "base_token_price_native_currency": "0.00063111259894421",
              "quote_token_price_usd": "0.998757565692604",
              "quote_token_price_native_currency": "0.000637796587178776",
              "base_token_price_quote_token": "0.9895201881",
              "quote_token_price_base_token": "1.0105908015",
              "address": "0x6d0b9c9e92a3de30081563c3657b5258b3ffa38b",
              "name": "USDz / USDC",
              "pool_created_at": "2024-05-22T02:00:04Z",
              "fdv_usd": "114444057.089853",
              "market_cap_usd": "124306472.308307",
              "price_change_percentage": {
                "m5": "0",
                "m15": "0",
                "m30": "0",
                "h1": "-1.52",
                "h6": "-0.39",
                "h24": "-0.2"
              },
              "transactions": {
                "m5": {
                  "buys": 0,
                  "sells": 0,
                  "buyers": 0,
                  "sellers": 0
                },
                "m15": {
                  "buys": 0,
                  "sells": 0,
                  "buyers": 0,
                  "sellers": 0
                },
                "m30": {
                  "buys": 0,
                  "sells": 0,
                  "buyers": 0,
                  "sellers": 0
                },
                "h1": {
                  "buys": 1,
                  "sells": 2,
                  "buyers": 1,
                  "sellers": 2
                },
                "h6": {
                  "buys": 5,
                  "sells": 10,
                  "buyers": 4,
                  "sellers": 8
                },
                "h24": {
                  "buys": 23,
                  "sells": 55,
                  "buyers": 5,
                  "sellers": 31
                }
              },
              "volume_usd": {
                "m5": "0.0",
                "m15": "0.0",
                "m30": "0.0",
                "h1": "276.6643908159",
                "h6": "2527.6780576674",
                "h24": "27258.7391844075"
              },
              "reserve_in_usd": "340057.2872",
              "locked_liquidity_percentage": null
            },
            "relationships": {
              "base_token": {
                "data": {
                  "id": "base_0x04d5ddf5f3a8939889f11e97f8c4bb48317f1938",
                  "type": "token"
                }
              },
              "quote_token": {
                "data": {
                  "id": "base_0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                  "type": "token"
                }
              },
              "dex": {
                "data": {
                  "id": "aerodrome-base",
                  "type": "dex"
                }
              }
            }
          }
        ]
      }"#;

        let value: GeckoTerminalMultipleResponce =
            serde_json::from_str(raw).expect("This should never happen");
        assert_eq!(value.data.len(), 5);
    }
}
