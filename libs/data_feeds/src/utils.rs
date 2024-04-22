use std::{
    env,
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
