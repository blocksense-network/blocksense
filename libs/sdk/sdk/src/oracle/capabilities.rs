use std::collections::HashMap;

use crate::oracle::Settings;

pub type Capabilities = HashMap<String, String>;

pub fn get_capabilities_from_settings(settings: &Settings) -> Capabilities {
    settings
        .capabilities
        .iter()
        .map(|cap| (cap.id.to_string(), cap.data.to_string()))
        .collect()
}

pub fn get_api_keys(capabilities: &Capabilities, keys: &[&str]) -> Option<HashMap<String, String>> {
    keys.iter()
        .map(|&key| {
            capabilities
                .get(key)
                .map(|value| (key.to_string(), value.clone()))
        })
        .collect()
}

#[test]
fn test_get_api_keys() {
    let mut capabilities = std::collections::HashMap::new();
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
