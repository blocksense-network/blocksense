use anyhow::{Context, Ok, Result};
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    spin::http::{send, Method, Request, Response},
};

use serde::{Deserialize, Serialize};
use serde_this_or_that::as_f64;

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct PoolAttributes {
    pub address: String,
    pub name: String,
    #[serde(deserialize_with = "as_f64")]
    pub price_in_usd: f64,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct GeckoTerminalData {
    pub id: String,
    pub attributes: PoolAttributes,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct GeckoTerminalResponce {
    pub data: GeckoTerminalData,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GeckoTerminalPool {
    pub network: String,
    pub pool: String,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    println!("Starting oracle component - Gecko Terminal");

    let mut payload: Payload = Payload::new();

    for feed in settings.data_feeds {
        let pool_with_network: GeckoTerminalPool =
            serde_json::from_str(&feed.data).context("Can't parse GeckoTerminalPool resource")?;
        let network = pool_with_network.network;
        let pool = pool_with_network.pool;
        let url = format!("https://app.geckoterminal.com/api/p1/{network}/pools/{pool}");
        // let url = "https://app.geckoterminal.com/api/p1/monad-testnet/pools/0x8552706d9a27013f20ea0f9df8e20b61e283d2d3";
        let mut req = Request::builder();
        req.method(Method::Get);
        req.uri(url.as_str());
        let resp: Response = send(req).await?;
        let body = resp.into_body();
        let string = String::from_utf8(body)?;
        let value: GeckoTerminalResponce = serde_json::from_str(&string)
            .context("Couldn't parse Gecko terminal response properly")?;
        payload.values.push(DataFeedResult {
            id: feed.id,
            value: DataFeedResultValue::Numerical(value.data.attributes.price_in_usd),
        });
    }
    println!("{payload:?}");
    Ok(payload)
}

#[cfg(test)]
mod tests {
    use crate::GeckoTerminalResponce;
    #[test]
    fn test_parsing_responce() {
        let raw = r#"{
            "data":{
                "id":"171227265",
                "type":"pool",
                "attributes":{
                    "address":"0x8552706d9a27013f20ea0f9df8e20b61e283d2d3",
                    "name":"USDT / WMON 0.2%",
                    "fully_diluted_valuation":"1817838994588.86",
                    "base_token_id":"38534023",
                    "price_in_usd":"181.783899458886",
                    "price_in_target_token":"10.0009767679",
                    "reserve_in_usd":"1308999961.9237",
                    "reserve_threshold_met":true,
                    "from_volume_in_usd":"50075.0824436682",
                    "to_volume_in_usd":"50075.0824436682",
                    "api_address":"0x8552706d9a27013f20ea0f9df8e20b61e283d2d3",
                    "pool_fee":"0.2%",
                    "token_weightages":null,
                    "token_reserves":{
                        "38534023":{
                            "reserves":"7197341.24226823",
                            "reserves_in_usd":1308369509.3935878
                        },
                        "38379114":{
                            "reserves":"33411.1466004131",
                            "reserves_in_usd":607305.5948889041
                        }
                    },
                    "token_value_data":{
                        "38534023":{
                            "fdv_in_usd":1817851155520.9482,
                            "market_cap_in_usd":null,
                            "market_cap_to_holders_ratio":null
                        },
                        "38379114":{
                            "fdv_in_usd":1840830347.322756,
                            "market_cap_in_usd":null,
                            "market_cap_to_holders_ratio":null
                        }
                    },
                    "balancer_pool_id":null,
                    "swap_count_24h":8215,
                    "swap_url":"https://alpha.izumi.finance/trade/swap?outputCurrency=0x6a7436775c0d0b70cff4c5365404ec37c9d9af4b",
                    "sentiment_votes":{
                        "total":0.0,
                        "up_percentage":0,
                        "down_percentage":0
                    },
                    "price_percent_change":"-5.9%",
                    "price_percent_changes":{
                        "last_5m":"-0.41%",
                        "last_15m":"-0.54%",
                        "last_30m":"-0.73%",
                        "last_1h":"-1.15%",
                        "last_6h":"-2.35%",
                        "last_24h":"-5.9%"
                    },
                    "historical_data":{
                        "last_5m":{
                            "swaps_count":11,
                            "buyers_count":1,
                            "price_in_usd":"182.5310041265",
                            "sellers_count":10,
                            "volume_in_usd":"362.2660782419",
                            "buy_swaps_count":1,
                            "sell_swaps_count":10
                        },
                        "last_15m":{
                            "swaps_count":23,
                            "buyers_count":13,
                            "price_in_usd":"182.7618519101",
                            "sellers_count":10,
                            "volume_in_usd":"727.4782276277",
                            "buy_swaps_count":13,
                            "sell_swaps_count":10
                        },
                        "last_30m":{
                            "swaps_count":31,
                            "buyers_count":15,
                            "price_in_usd":"183.1175400712",
                            "sellers_count":12,
                            "volume_in_usd":"727.9833855317",
                            "buy_swaps_count":18,
                            "sell_swaps_count":13
                        },
                        "last_1h":{
                            "swaps_count":39,
                            "buyers_count":22,
                            "price_in_usd":"183.8985543357",
                            "sellers_count":12,
                            "volume_in_usd":"768.7889156705",
                            "buy_swaps_count":26,
                            "sell_swaps_count":13
                        },
                        "last_6h":{
                            "swaps_count":257,
                            "buyers_count":160,
                            "price_in_usd":"186.1624889329",
                            "sellers_count":31,
                            "volume_in_usd":"2018.1630831767",
                            "buy_swaps_count":220,
                            "sell_swaps_count":37
                        },
                        "last_24h":{
                            "swaps_count":8215,
                            "buyers_count":4051,
                            "price_in_usd":"193.1915026651",
                            "sellers_count":763,
                            "volume_in_usd":"50075.0824436682",
                            "buy_swaps_count":7242,
                            "sell_swaps_count":973
                        }
                    },
                    "locked_liquidity":null,
                    "security_indicators":[],
                    "gt_score":34.862385321100916,
                    "gt_score_details":{"info":0.0,"pool":31.25,"transactions":60.0,"holders":0.0,"creation":50.0},
                    "pool_reports_count":0,
                    "pool_created_at":"2025-02-27T07:11:12.925Z",
                    "latest_swap_timestamp":"2025-03-12T08:59:51Z",
                    "high_low_price_data_by_token_id":{
                        "38379114":{
                            "high_price_in_usd_24h":19.6155703601,
                            "high_price_timestamp_24h":"2025-03-11T19:03:12Z",
                            "low_price_in_usd_24h":18.1766145126,
                            "low_price_timestamp_24h":"2025-03-12T08:59:51Z"
                        },
                        "38534023":{
                            "high_price_in_usd_24h":196.9619233054,
                            "high_price_timestamp_24h":"2025-03-11T19:03:12Z",
                            "low_price_in_usd_24h":181.7838994589,
                            "low_price_timestamp_24h":"2025-03-12T08:59:51Z"
                        }
                    },
                    "is_nsfw":false,
                    "is_stale_pool":null,
                    "is_pool_address_explorable":true
                },
                "relationships":{
                    "dex":{"data":{"id":"21916","type":"dex"}},
                    "tokens":{"data":[{"id":"38534023","type":"token"},{"id":"38379114","type":"token"}]},
                    "pool_metric":{"data":{"id":"4758509","type":"pool_metric"}},
                    "pairs":{"data":[{"id":"8774160","type":"pair"}]}}
                }
            }"#;

        let value: GeckoTerminalResponce =
            serde_json::from_str(raw).expect("This should never happen");
        assert_eq!(value.data.id, "171227265");
        assert_eq!(value.data.attributes.name, "USDT / WMON 0.2%");
        assert_eq!(
            value.data.attributes.address,
            "0x8552706d9a27013f20ea0f9df8e20b61e283d2d3"
        );
        assert_eq!(value.data.attributes.price_in_usd, 181.783899458886 as f64);
    }
}
