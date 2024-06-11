use erased_serde::serialize_trait_object;

use crate::types::Bytes32;

use super::error::ConversionError;

serialize_trait_object!(Payload);

pub trait Payload: erased_serde::Serialize {
    fn to_bytes32(&self) -> Result<Bytes32, ConversionError>;
}
