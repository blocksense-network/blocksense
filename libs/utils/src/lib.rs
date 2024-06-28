use std::{
    env,
    fmt::{Debug, Display},
    hash::{DefaultHasher, Hash, Hasher},
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};

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

pub fn generate_string_hash(string: &str) -> u64 {
    let mut hasher = DefaultHasher::new();

    string.hash(&mut hasher);

    hasher.finish()
}

pub fn to_hex_string(mut bytes: Vec<u8>, padding_to: Option<usize>) -> String {
    //TODO(snikolov): Return Bytes32 type
    if let Some(p) = padding_to {
        bytes.resize(p, 0);
    }
    bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<_>>()
        .join("")
}
