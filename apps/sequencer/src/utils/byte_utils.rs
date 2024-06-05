pub fn to_hex_string(mut bytes: Vec<u8>, padding_to: Option<usize>) -> String {
    if let Some(p) = padding_to {
        bytes.resize(p, 0);
    }
    bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<_>>()
        .join("")
}
