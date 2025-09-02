use tracing::warn;

pub fn print_missing_provider_price_data<T>(
    provider: &str,
    symbol: String,
    price: Option<T>,
    volume: Option<T>,
) {
    let mut missing_fields = Vec::new();
    if price.is_none() {
        missing_fields.push("price");
    }
    if volume.is_none() {
        missing_fields.push("volume");
    }

    if !missing_fields.is_empty() {
        warn!(
            "[{provider}] Skipping symbol {symbol}: missing {}",
            missing_fields.join(" and ")
        );
    }
}
