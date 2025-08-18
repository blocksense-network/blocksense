use std::{collections::HashMap, str::FromStr};

use alloy::primitives::Address;
use anyhow::Result;
use blocksense_sdk::oracle::Settings;
use serde::{Deserialize, Serialize};

use blocksense_data_providers_sdk::price_data::types::PricePair;

pub type FeedId = u128;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OracleArgs {
    pub marketplace: String,
    pub market_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FeedConfig {
    #[serde(default)]
    pub feed_id: FeedId,
    pub pair: PricePair,
    #[serde(default)]
    pub decimals: u32,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub market_hours: String,
    pub arguments: OracleArgs,
}

#[derive(Debug, Clone)]
pub struct BorrowRateInfo {
    pub asset: String,
    pub underlying_asset: Option<Address>,
    pub borrow_rate: f64,
}

pub type RatesPerFeed = HashMap<FeedId, BorrowRateInfo>;

pub type RatesPerFeedPerMarket = HashMap<Marketplace, RatesPerFeed>;

#[derive(Debug, Eq, PartialEq, Hash, Clone)]
pub enum Marketplace {
    HypurrFi,
    HyperLend,
    HyperDrive,
}

impl FromStr for Marketplace {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "HypurrFi" => Ok(Marketplace::HypurrFi),
            "HyperLend" => Ok(Marketplace::HyperLend),
            "HyperDrive" => Ok(Marketplace::HyperDrive),
            _ => Err(anyhow::anyhow!("Unknown marketplace: {}", s)),
        }
    }
}

pub fn group_feeds_by_marketplace(
    feeds_config: &Vec<FeedConfig>,
) -> HashMap<Marketplace, Vec<FeedConfig>> {
    let mut grouped: HashMap<Marketplace, Vec<FeedConfig>> = HashMap::new();

    for feed in feeds_config {
        match Marketplace::from_str(feed.arguments.marketplace.as_str()) {
            Ok(market) => grouped.entry(market).or_default().push(feed.clone()),
            Err(_) => {
                eprintln!("Unknown marketplace: {}", feed.arguments.marketplace);
            }
        }
    }

    grouped
}

pub fn map_assets_to_feeds(
    rates: Vec<BorrowRateInfo>,
    feeds_config: &Vec<FeedConfig>,
) -> RatesPerFeed {
    let rates_map: HashMap<_, _> = rates.into_iter().map(|r| (r.asset.clone(), r)).collect();

    feeds_config
        .iter()
        .map(|feed| {
            let base = &feed.pair.base;
            match rates_map.get(base) {
                Some(rate) => Some((feed.feed_id.clone(), rate.clone())),
                None => {
                    eprintln!(
                        "[map_assets_to_feeds] No reserve info found for feed_id={} with base={}",
                        feed.feed_id, base
                    );
                    None
                }
            }
        })
        .flatten()
        .collect()
}

pub fn get_resources_from_settings(settings: &Settings) -> Result<Vec<FeedConfig>> {
    let mut config: Vec<FeedConfig> = Vec::new();
    for feed_setting in &settings.data_feeds {
        match serde_json::from_str::<FeedConfig>(&feed_setting.data) {
            Ok(mut feed_config) => {
                feed_config.feed_id = feed_setting.id.parse::<FeedId>()?;
                config.push(feed_config);
            }
            Err(err) => {
                println!(
                    "Error {err} when parsing feed settings data = '{}'",
                    &feed_setting.data
                );
            }
        }
    }
    Ok(config)
}
