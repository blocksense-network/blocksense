use std::{
    env,
    fmt::{Debug, Display},
    fs::File,
    hash::{DefaultHasher, Hash, Hasher},
    io::Read,
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};

pub fn current_unix_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("SystemTime before UNIX EPOCH!")
        .as_secs()
}

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

pub fn read_file(path: &str) -> String {
    let mut file = File::open(path).expect(format!("File not found in {}", path).as_str());
    let mut data = String::new();
    file.read_to_string(&mut data)
        .expect(format!("File {} read failure! ", path).as_str());
    data
}
