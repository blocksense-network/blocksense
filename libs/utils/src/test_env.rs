use std::{path::PathBuf, sync::OnceLock};

use crate::write_flush_file;

pub fn get_test_private_key_path() -> &'static PathBuf {
    static KEY_PATH: OnceLock<PathBuf> = OnceLock::new();
    KEY_PATH.get_or_init(move || {
        let key_path = PathBuf::from("/tmp").join("priv_key_test");
        let private_key =
            "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356".to_string();
        write_flush_file(key_path.as_path(), &private_key).expect("Could not create private key");
        key_path
    })
}
