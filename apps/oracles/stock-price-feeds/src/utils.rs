use crate::types::Capabilities;

pub fn get_api_key<'a>(capabilities: Option<&'a Capabilities>, key: &str) -> Option<&'a str> {
    capabilities.and_then(|c| c.get(key)).map(|s| s.as_str())
}
