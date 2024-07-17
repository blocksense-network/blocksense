pub use blst::min_pk::PublicKey;
pub use blst::min_pk::SecretKey;
pub use blst::min_pk::Signature;
use blst::*;
pub use hex::{decode, encode};

pub const MULTIFORMATS_BLS_PUBKYE_PREFIX: &str = "ea30";

pub fn generate_keys(ikm: &[u8; 35]) -> (SecretKey, PublicKey) {
    let sk = SecretKey::key_gen(ikm, &[]).expect("Failed to generate secret key");
    let pk = sk.sk_to_pk();
    (sk, pk)
}

pub fn sign_message(sk: &SecretKey, message: &[u8]) -> Signature {
    sk.sign(message, &[], &[])
}

pub fn verify_signature(pk: &PublicKey, signature: &Signature, message: &[u8]) -> bool {
    signature.verify(true, message, &[], &[], pk, true) == BLST_ERROR::BLST_SUCCESS
}

pub fn serialize_public_key(pk: &PublicKey) -> String {
    encode(pk.to_bytes())
}

pub fn deserialize_public_key(hex: &str) -> Result<PublicKey, String> {
    let bytes = decode(hex).map_err(|e| format!("Invalid hex string: {}", e))?;
    PublicKey::from_bytes(&bytes).map_err(|e| format!("Failed to deserialize public key: {:?}", e))
}

pub fn serialize_priv_key(sk: &SecretKey) -> String {
    encode(sk.to_bytes())
}

pub fn deserialize_priv_key(hex: &str) -> Result<SecretKey, String> {
    let bytes = decode(hex).map_err(|e| format!("Invalid hex string: {}", e))?;
    SecretKey::from_bytes(&bytes).map_err(|e| format!("Failed to deserialize public key: {:?}", e))
}
