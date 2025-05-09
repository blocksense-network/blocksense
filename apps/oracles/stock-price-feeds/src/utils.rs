use anyhow::{Error, Result};
use chrono::Datelike;
use chrono::{NaiveTime, Utc};
use chrono_tz::US::Eastern;

use crate::types::Capabilities;

pub fn get_api_key<'a>(capabilities: Option<&'a Capabilities>, key: &str) -> Option<&'a str> {
    capabilities.and_then(|c| c.get(key)).map(|s| s.as_str())
}

pub fn print_missing_network_price_data<T>(
    network: &str,
    symbol: String,
    price: Option<T>,
    volume: Option<T>,
) {
    eprintln!(
        "[{network}] Skipping symbol {}: missing {}{}{}",
        symbol,
        if price.is_none() { "price" } else { "" },
        if price.is_none() && volume.is_none() {
            " and "
        } else {
            ""
        },
        if volume.is_none() { "volume" } else { "" },
    );
}

pub fn are_markets_open() -> Result<bool> {
    let now_et = Utc::now().with_timezone(&Eastern);

    let weekday = now_et.weekday();
    let current_time = now_et.time();

    let market_hours_start_time =
        NaiveTime::from_hms_opt(9, 30, 0).ok_or_else(|| Error::msg("Invalid market start time"))?;
    let market_hours_end_time =
        NaiveTime::from_hms_opt(16, 0, 0).ok_or_else(|| Error::msg("Invalid market end time"))?;

    if weekday == chrono::Weekday::Sat
        || weekday == chrono::Weekday::Sun
        || current_time < market_hours_start_time
        || current_time > market_hours_end_time
    {
        return Ok(false);
    }
    Ok(true)
}

#[test]
fn test_get_api_key() {
    let mut capabilities = Capabilities::new();
    capabilities.insert("API_KEY".to_string(), "test_key".to_string());

    let result = get_api_key(Some(&capabilities), "API_KEY");
    assert_eq!(result, Some("test_key"));

    let result = get_api_key(Some(&capabilities), "NON_EXISTENT_KEY");
    assert_eq!(result, None);

    let result = get_api_key(None, "API_KEY");
    assert_eq!(result, None);
}
