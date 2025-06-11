use serde::{ser::Error, Serialize, Serializer};
use serde_json::Value;

pub fn serialize_string_as_json<S>(data_str: &String, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match serde_json::from_str::<Value>(data_str) {
        Ok(json_value) => json_value.serialize(serializer),
        Err(e) => Err(S::Error::custom(format!(
            "Failed to parse data field as JSON: {e}. Content: '{data_str}'"
        ))),
    }
}
