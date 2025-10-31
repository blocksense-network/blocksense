use std::collections::HashMap;

use anyhow::{Context, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use blocksense_sdk::http::http_get_json;
use ssz::Encode;
use ssz_derive::Encode;

use crate::sports_data::traits::sports_fetcher::SportsFetcher;

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastEventData {
    #[serde(rename = "idEvent", deserialize_with = "deserialize_u64_from_str")]
    pub event_id: u64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastEvent {
    pub results: Vec<LastEventData>,
}

type LastEventResponse = LastEvent;

fn deserialize_utf8_bytes<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Ok(s.into_bytes())
}

fn deserialize_u64_from_str<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    s.parse().map_err(serde::de::Error::custom)
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize, Encode)]
#[serde(rename_all = "camelCase")]
pub struct EventLookupData {
    #[serde(rename = "strEvent", deserialize_with = "deserialize_utf8_bytes")]
    pub event_name: Vec<u8>,

    #[serde(rename = "strSeason", deserialize_with = "deserialize_utf8_bytes")]
    pub season: Vec<u8>,

    #[serde(rename = "strHomeTeam", deserialize_with = "deserialize_utf8_bytes")]
    pub home_team: Vec<u8>,

    #[serde(rename = "strAwayTeam", deserialize_with = "deserialize_utf8_bytes")]
    pub away_team: Vec<u8>,

    #[serde(rename = "intHomeScore", deserialize_with = "deserialize_u64_from_str")]
    pub home_score: u64,

    #[serde(rename = "intAwayScore", deserialize_with = "deserialize_u64_from_str")]
    pub away_score: u64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventLookup {
    pub events: Vec<EventLookupData>,
}

type EventLookupResponse = EventLookup;

pub struct LastTeamEventFetcher {
    pub id: u64,
}

impl SportsFetcher for LastTeamEventFetcher {
    fn new(id: u64, _api_keys: Option<HashMap<String, String>>) -> Self {
        Self { id }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<'_, Result<Vec<u8>>> {
        async move {
            let response = http_get_json::<LastEventResponse>(
                "https://www.thesportsdb.com/api/v1/json/123/eventslast.php",
                Some(&[("id", &self.id.to_string())]),
                None,
                Some(timeout_secs),
            )
            .await?;

            // Return the first event data if available
            let first_result = response.results.first().context("No event results found")?;
            let response = http_get_json::<EventLookupResponse>(
                "https://www.thesportsdb.com/api/v1/json/123/lookupevent.php",
                Some(&[("id", &first_result.event_id.to_string())]),
                None,
                Some(timeout_secs),
            )
            .await?;

            // Return the first event data if available
            if let Some(first_event) = response.events.first() {
                Ok(first_event.as_ssz_bytes())
            } else {
                Err(anyhow::anyhow!("No event data found for the given ID"))
            }
        }
        .boxed_local()
    }
}
