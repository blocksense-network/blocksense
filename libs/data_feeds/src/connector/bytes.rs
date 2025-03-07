use thiserror::Error;

use feed_registry::types::Bytes32;

pub fn string_to_bytes32(x: String) -> Result<Bytes32, ConversionError> {
    let string_bytes = x.as_bytes();
    if string_bytes.len() > 32 {
        Err(ConversionError::StringTooLong)
    } else {
        let mut bytes = [0u8; 32];
        bytes[..string_bytes.len()].copy_from_slice(string_bytes);
        Ok(Bytes32(bytes))
    }
}

/// Convert the f64 to bytes in little-endian order
pub fn f64_to_bytes32(x: f64) -> Result<Bytes32, ConversionError> {
    let mut bytes = [0u8; 32];
    let float_bytes = x.to_le_bytes();
    bytes[..float_bytes.len()].copy_from_slice(&float_bytes);
    Ok(Bytes32(bytes))
}

#[derive(Error, Debug)]
pub enum ConversionError {
    #[error("String larger than Bytes32")]
    StringTooLong,
}
