#![allow(unused_imports)]
use chrono::{Datelike, NaiveTime, TimeZone};
use chrono_tz::US::Eastern;

use crate::types::Capabilities;

pub fn get_api_key<'a>(capabilities: &'a Capabilities, key: &str) -> Option<&'a str> {
    capabilities.get(key).map(|s| s.as_str())
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

pub fn markets_are_closed(now_et: chrono::DateTime<chrono_tz::Tz>) -> bool {
    let weekday = now_et.weekday();
    let current_time = now_et.time();

    let start_time = NaiveTime::from_hms_opt(9, 30, 0).unwrap();
    let end_time = NaiveTime::from_hms_opt(16, 0, 0).unwrap();

    let is_weekend = matches!(weekday, chrono::Weekday::Sat | chrono::Weekday::Sun);
    let is_outside_market_hours = current_time < start_time || current_time > end_time;

    is_weekend || is_outside_market_hours
}

#[test]
fn test_get_api_key() {
    let mut capabilities = Capabilities::new();
    capabilities.insert("API_KEY".to_string(), "test_key".to_string());

    let result = get_api_key(&capabilities, "API_KEY");
    assert_eq!(result, Some("test_key"));

    let result = get_api_key(&capabilities, "NON_EXISTENT_KEY");
    assert_eq!(result, None);

    let empty_capabilities = Capabilities::new();
    let result = get_api_key(&empty_capabilities, "API_KEY");
    assert_eq!(result, None);
}

#[test]
fn test_markets_are_closed() {
    let test_cases = [
        // Weekdays - markets open
        ((2025, 5, 12), (9, 30, 0), false), // Monday right at market open
        ((2025, 5, 13), (10, 0, 0), false), // Tuesday
        ((2025, 5, 14), (12, 0, 0), false), // Wednesday
        ((2025, 5, 15), (15, 40, 52), false), // Thursday
        ((2025, 5, 16), (16, 0, 0), false), // Friday right at market close
        // Weekdays - markets closed
        ((2025, 5, 12), (9, 29, 59), true), // Monday right before market open
        ((2025, 5, 13), (16, 0, 1), true),  // Tuesday right after market close
        ((2025, 5, 14), (3, 0, 0), true),   // Wednesday before market open
        ((2025, 5, 15), (17, 0, 0), true),  // Thursday after market close
        ((2025, 5, 16), (23, 30, 0), true), // Friday middle of the night
        // Weekend - markets closed
        ((2025, 5, 10), (10, 0, 0), true), // Working hours but on Saturday
        ((2025, 5, 11), (10, 0, 0), true), // Working hours but on Sunday
        ((2025, 5, 10), (3, 0, 0), true),  // Non working hours but on Saturday
        ((2025, 5, 11), (3, 0, 0), true),  // Non working hours but on Sunday
    ];

    for ((year, month, day), (hour, min, sec), expected_closed) in test_cases {
        let mock_time = Eastern
            .with_ymd_and_hms(year, month, day, hour, min, sec)
            .single()
            .unwrap();

        assert_eq!(markets_are_closed(mock_time), expected_closed);
    }
}
