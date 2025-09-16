use alloy::primitives::Address;
use anyhow::Result;
use blocksense_sdk::oracle::Settings;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::{collections::HashMap, str::FromStr};
use strum_macros::AsRefStr;
use tracing::warn;

use blocksense_data_providers_sdk::price_data::types::PricePair;

pub type FeedId = u128;

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
    pub arguments: Marketplace,
}

#[derive(Debug, Clone)]
pub struct BorrowRateInfo {
    pub asset: String,
    pub underlying_asset: Option<Address>,
    pub borrow_rate: f64,
}

pub type RatesPerFeed = HashMap<FeedId, BorrowRateInfo>;

pub type RatesPerFeedPerMarket = HashMap<MarketplaceType, RatesPerFeed>;

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone, AsRefStr)]
#[serde(tag = "marketplace")]
pub enum Marketplace {
    Aave(AaveArgs),
    HypurrFi(HypurrFiArgs),
    HyperLend(HyperLendArgs),
    HyperDrive(HyperDriveArgs),
    EulerFinance(EulerFinanceArgs),
}

impl Marketplace {
    pub fn get_marketplace_network(&self) -> Option<SupportedNetworks> {
        match self {
            Marketplace::Aave(args) => Some(args.network),
            Marketplace::HypurrFi(args) => Some(args.network),
            Marketplace::HyperLend(args) => Some(args.network),
            Marketplace::EulerFinance(args) => Some(args.network),
            Marketplace::HyperDrive(_) => None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone)]
pub struct AaveArgs {
    pub network: SupportedNetworks,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone)]
pub struct HypurrFiArgs {
    pub network: SupportedNetworks,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone)]
pub struct HyperLendArgs {
    pub network: SupportedNetworks,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone)]
pub struct HyperDriveArgs {
    pub market_id: String,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone)]
pub struct EulerFinanceArgs {
    pub network: SupportedNetworks,
    pub utils_lens_address: Address,
    pub vault_address: Address,
}

#[derive(Debug, Eq, PartialEq, Hash, Clone, Copy)]
pub enum SupportedNetworks {
    HyperevmMainnet,
    EthereumMainnet,
}

impl FromStr for SupportedNetworks {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s {
            "hyperevm-mainnet" => SupportedNetworks::HyperevmMainnet,
            "ethereum-mainnet" => SupportedNetworks::EthereumMainnet,
            _ => anyhow::bail!("Unsupported network: {}", s),
        })
    }
}

impl Serialize for SupportedNetworks {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let s = match self {
            SupportedNetworks::HyperevmMainnet => "hyperevm-mainnet",
            SupportedNetworks::EthereumMainnet => "ethereum-mainnet",
        };
        serializer.serialize_str(s)
    }
}

impl<'de> Deserialize<'de> for SupportedNetworks {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        SupportedNetworks::from_str(&s).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Eq, PartialEq, Hash, Clone, Copy)]
pub enum UIPoolMarketplaceType {
    Aave,
    HypurrFi,
    HyperLend,
}

#[derive(Debug, Eq, PartialEq, Hash, Clone, Copy)]
pub enum MarketplaceType {
    UIPoolMarketplace(UIPoolMarketplaceType),
    HyperDrive,
    EulerFinance,
}

impl From<&Marketplace> for MarketplaceType {
    fn from(marketplace: &Marketplace) -> Self {
        match marketplace {
            Marketplace::Aave(_) => MarketplaceType::UIPoolMarketplace(UIPoolMarketplaceType::Aave),
            Marketplace::HypurrFi(_) => {
                MarketplaceType::UIPoolMarketplace(UIPoolMarketplaceType::HypurrFi)
            }
            Marketplace::HyperLend(_) => {
                MarketplaceType::UIPoolMarketplace(UIPoolMarketplaceType::HyperLend)
            }
            Marketplace::HyperDrive(_) => MarketplaceType::HyperDrive,
            Marketplace::EulerFinance(_) => MarketplaceType::EulerFinance,
        }
    }
}

pub fn group_feeds_by_marketplace_type(
    feeds_config: &[FeedConfig],
) -> HashMap<MarketplaceType, Vec<FeedConfig>> {
    let mut grouped: HashMap<MarketplaceType, Vec<FeedConfig>> = HashMap::new();

    for feed in feeds_config {
        let marketplace_type = MarketplaceType::from(&feed.arguments);
        grouped
            .entry(marketplace_type)
            .or_default()
            .push(feed.clone())
    }

    grouped
}

pub fn map_assets_to_feeds(
    rates: Vec<BorrowRateInfo>,
    feeds_config: &[FeedConfig],
    network: Option<SupportedNetworks>,
) -> RatesPerFeed {
    let rates_map: HashMap<_, _> = rates.into_iter().map(|r| (r.asset.clone(), r)).collect();

    let feeds_config: Vec<FeedConfig> = match network {
        Some(net) => feeds_config
            .iter()
            .filter(|f| {
                f.arguments
                    .get_marketplace_network()
                    .map(|n| n == net)
                    .unwrap_or(true)
            })
            .cloned()
            .collect(),
        None => feeds_config.to_vec(),
    };
    feeds_config
        .iter()
        .map(|feed| {
            let base = &feed.pair.base;
            match rates_map.get(base) {
                Some(rate) => Some((feed.feed_id.clone(), rate.clone())),
                None => {
                    warn!(
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
