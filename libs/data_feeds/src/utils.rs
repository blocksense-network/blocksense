use std::{
    env,
    hash::{DefaultHasher, Hash, Hasher},
    time::{SystemTime, UNIX_EPOCH},
};

pub fn current_unix_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("SystemTime before UNIX EPOCH!")
        .as_secs()
}

pub fn get_env_var(var: &str) -> String {
    match env::var(var) {
        Ok(key) => key,
        Err(err) => {
            eprintln!("Error: {}\n{} environment variable is not set.", err, var);
            std::process::exit(1);
        }
    }
}

pub fn generate_string_hash(string: &String) -> u64 {
    let mut hasher = DefaultHasher::new();

    string.as_str().hash(&mut hasher);

    hasher.finish()
}
