pub mod build_info;
pub mod logging;
pub mod time;

use std::{
    env,
    fmt::{Debug, Display},
    fs::File,
    hash::{DefaultHasher, Hash, Hasher},
    io::Read,
    path::PathBuf,
    str::FromStr,
};

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

pub fn read_file(path: &str) -> String {
    let mut file = File::open(path).unwrap_or_else(|_| panic!("File not found in {}", path));
    let mut data = String::new();
    file.read_to_string(&mut data)
        .unwrap_or_else(|_| panic!("File {} read failure! ", path));
    data
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
