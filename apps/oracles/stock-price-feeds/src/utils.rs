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
