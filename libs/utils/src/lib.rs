pub mod build_info;
pub mod constants;
pub mod logging;
pub mod test_env;
pub mod time;

use std::{
    env,
    fmt::{Debug, Display},
    fs::File,
    hash::{DefaultHasher, Hash, Hasher},
    io::{Read, Write},
    path::{Path, PathBuf},
    str::FromStr,
};

use anyhow::{anyhow, Context, Result};

pub fn get_env_var<T>(key: &str) -> Result<T>
where
    T: FromStr,
    T::Err: Debug + Display,
{
    let value_str = env::var(key).map_err(|_| anyhow!("Environment variable '{key}' not set"))?;
    value_str
        .parse()
        .map_err(|err| anyhow!("Failed to parse environment variable '{key}': {err}"))
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

pub fn from_hex_string(input: &str) -> Result<Vec<u8>> {
    hex::decode(input).context("Decoding of hex failed")
}

pub fn read_file(path: &str) -> String {
    let mut file = File::open(path).unwrap_or_else(|_| panic!("File not found in {path}"));
    let mut data = String::new();
    file.read_to_string(&mut data)
        .unwrap_or_else(|_| panic!("File {path} read failure! "));
    data
}

pub fn write_flush_file(filename: &Path, content: &String) -> Result<()> {
    let mut file = File::create(filename)?;
    file.write_all(content.as_bytes())?;
    file.flush()?;
    Ok(())
}

pub fn get_config_file_path(base_path_from_env: &str, config_file_name: &str) -> PathBuf {
    let config_file_path = env::var(base_path_from_env).unwrap_or_else(|_| {
        let conf_dir = dirs::config_dir().expect("Configuration file path not specified.");
        let conf_dir = conf_dir.join("blocksense");
        conf_dir
            .to_str()
            .expect("Configuration file path not valid.")
            .to_string()
    });
    let config_file_path: PathBuf = config_file_path.as_str().into();
    config_file_path.join(config_file_name)
}
