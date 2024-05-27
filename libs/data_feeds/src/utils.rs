use std::{
    env,
    fmt::{Debug, Display},
    hash::{DefaultHasher, Hash, Hasher},
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};

use prometheus::{Registry, TextEncoder};
use reqwest::Client;

pub fn current_unix_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("SystemTime before UNIX EPOCH!")
        .as_secs()
}

pub fn get_env_var<T>(key: &str) -> Result<T, String>
where
    T: FromStr,
    T::Err: Debug + Display,
{
    let value_str = env::var(key).map_err(|_| format!("Environment variable '{}' not set", key))?;
    value_str
        .parse()
        .map_err(|err| format!("Failed to parse environment variable '{}': {}", key, err))
}

pub fn generate_string_hash(string: &String) -> u64 {
    let mut hasher = DefaultHasher::new();

    string.as_str().hash(&mut hasher);

    hasher.finish()
}

pub async fn handle_prometheus_metrics(
    client: &Client,
    url: &str,
    encoder: &TextEncoder,
) -> Result<(), anyhow::Error> {
    let mut buffer = String::new();

    let metric_families = prometheus::gather();
    encoder.encode_utf8(&metric_families, &mut buffer).unwrap();

    let _ = client.post(url).body(buffer.to_string()).send().await?;

    // buffer.clear();

    Ok(())
}
