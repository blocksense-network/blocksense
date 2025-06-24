use blocksense_utils::FeedId;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct OraclesResponse {
    /// All registered oracles
    #[serde(default)]
    pub oracles: Vec<OracleScript>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct FeedsResponse {
    /// All registered data feeds
    #[serde(default)]
    pub feeds: Vec<FeedConfig>,
}

//TODO(melatron): This is duplicated from the config crate
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct AssetPair {
    pub base: String,
    pub quote: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct FeedQuorum {
    pub percentage: f32,
    pub aggregation: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct FeedSchedule {
    pub interval_ms: u64,
    pub heartbeat_ms: Option<u128>,
    pub deviation_percentage: f32,
    pub first_report_start_unix_time_ms: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct PriceFeedInfo {
    pub pair: AssetPair,
    pub decimals: u8,
    pub category: String,
    pub market_hours: Option<String>,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct CompatibilityInfo {
    pub chainlink: String,
}

//TODO(melatron): This is duplicated from the config crate
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct FeedConfig {
    #[serde(with = "crate::custom_serde::serde_string")]
    pub id: FeedId,
    pub full_name: String,
    pub description: String,
    #[serde(rename = "type")] // rename because of reserved keyword
    pub feed_type: String,
    pub oracle_id: String,
    pub value_type: String,
    pub stride: u8,
    pub quorum: FeedQuorum,
    pub schedule: FeedSchedule,
    pub additional_feed_info: PriceFeedInfo,
    pub compatibility_info: Option<CompatibilityInfo>,
}

impl FeedConfig {
    pub fn compare(left: &FeedConfig, right: &FeedConfig) -> std::cmp::Ordering {
        left.id.cmp(&right.id)
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReporterInfo {
    /// Time interval in seconds of executing all oracles
    pub interval_time_in_seconds: u64,
    /// Sequencer URL
    #[serde(default)]
    pub sequencer: String,
    /// Metrics URL
    #[serde(default)]
    pub metrics_url: String,
    /// Kafka endpoint
    pub kafka_endpoint: Option<String>,
    /// Registry URL
    pub registry: String,
    /// Reporter secret key for signing transactions
    pub secret_key: String,
    /// Reporter secret key for second consensus
    pub second_consensus_secret_key: Option<String>,
    /// Reporter id
    pub reporter_id: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct BlocksenseConfig {
    /// Information and data needed for the reporter
    #[serde(default)]
    pub reporter_info: ReporterInfo,
    /// List of all the oracle scripts
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub oracles: Vec<OracleScript>,
    /// List of all the capabilities scripts
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub capabilities: Vec<Capability>,
    /// List of all data feeds
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub data_feeds: Vec<FeedConfig>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OracleScript {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interval_time_in_seconds: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Description for the Oracle script.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// "local.wasm"
    #[serde(default)]
    pub oracle_script_wasm: String,
    /// Allowed hosts
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_outbound_hosts: Vec<String>,
    /// List of all the needed capabilities
    #[serde(default, skip_serializing_if = "HashSet::is_empty")]
    pub capabilities: HashSet<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Capability {
    pub id: String,
    pub data: String,
}

#[cfg(test)]
mod tests {
    use crate::config::FeedConfig;

    #[test]
    fn test_parsing_feed_config_v2() {
        let json = r#"
    {
      "id": "0",
      "full_name": "BTC / USD",
      "description": "Price of Bitcoin in USD",
      "type": "price-feed",
      "oracle_id": "cex-price-feeds",
      "value_type": "numerical",
      "stride": 0,
      "quorum": {
        "percentage": 75,
        "aggregation": "median"
      },
      "schedule": {
        "interval_ms": 90000,
        "heartbeat_ms": 3600000,
        "deviation_percentage": 0.1,
        "first_report_start_unix_time_ms": 0
      },
      "additional_feed_info": {
        "pair": {
          "base": "BTC",
          "quote": "USD"
        },
        "decimals": 8,
        "category": "Crypto",
        "market_hours": "Crypto",
        "arguments": {
          "exchanges": {
            "Binance": {
              "symbol": ["BTCUSDC", "BTCUSDT"]
            },
            "BinanceUS": {
              "symbol": ["BTCUSD", "BTCUSDC", "BTCUSDT"]
            },
            "Bitfinex": {
              "symbol": ["tBTCUSD"]
            },
            "Bitget": {
              "symbol": ["BTCUSDC", "BTCUSDT"]
            },
            "Bybit": {
              "symbol": ["BTCUSDC", "BTCUSDT"]
            },
            "Coinbase": {
              "id": ["BTC-USD", "BTC-USDT"]
            },
            "CryptoCom": {
              "symbol": ["BTC_USD", "BTC_USDT"]
            },
            "GateIo": {
              "id": ["BTC_USDC", "BTC_USDT"]
            },
            "Gemini": {
              "symbol": ["BTCUSD", "BTCUSDT"]
            },
            "KuCoin": {
              "symbol": ["BTC-USDC", "BTC-USDT"]
            },
            "MEXC": {
              "symbol": ["BTCUSDC", "BTCUSDT"]
            },
            "OKX": {
              "instId": ["BTC-USD", "BTC-USDC", "BTC-USDT"]
            },
            "Upbit": {
              "market": ["USDT-BTC"]
            }
          },
          "aggregators": {
            "CoinMarketCap": {
              "symbol": ["BTC", "BTC", "BTC", "BTC", "BTC"],
              "id": [1, 31469, 31652, 32295, 34316]
            }
          }
        },
        "compatibility_info": {
          "chainlink": "BTC / USD"
        }
      }
    }
"#;

        let config = serde_json::from_str::<FeedConfig>(json)
            .map_err(|e| anyhow::anyhow!("Config is not valid JSON! {e}"))
            .unwrap();
        assert_eq!(config.id, 0_u128);
        assert_eq!(config.stride, 0);
    }
}
