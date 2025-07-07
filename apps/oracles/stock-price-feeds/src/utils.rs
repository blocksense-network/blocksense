#![allow(unused_imports)]
use std::collections::HashMap;

use chrono::{Datelike, NaiveTime, TimeZone};
use chrono_tz::US::Eastern;

use crate::types::Capabilities;

pub fn get_api_keys(capabilities: &Capabilities, keys: &[&str]) -> Option<HashMap<String, String>> {
    keys.iter()
        .map(|&key| {
            capabilities
                .get(key)
                .map(|value| (key.to_string(), value.clone()))
        })
        .collect()
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
fn test_get_api_keys() {
    let mut capabilities = Capabilities::new();
    capabilities.insert("API_KEY".to_string(), "test_key".to_string());

    let result = get_api_keys(&capabilities, &["API_KEY"]);
    assert_eq!(
        result,
        Some(HashMap::from([(
            "API_KEY".to_string(),
            "test_key".to_string()
        )]))
    );

    let result = get_api_keys(&capabilities, &["NON_EXISTENT_KEY"]);
    assert_eq!(result, None);

    let empty_capabilities = Capabilities::new();
    let result = get_api_keys(&empty_capabilities, &["API_KEY"]);
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
