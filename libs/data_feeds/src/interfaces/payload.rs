use erased_serde::serialize_trait_object;

use crate::{connector::error::ConversionError, types::Bytes32};

serialize_trait_object!(Payload);

pub trait Payload: erased_serde::Serialize {
    fn to_bytes32(&self) -> Result<Bytes32, ConversionError>;
}
