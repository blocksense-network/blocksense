use std::collections::HashMap;
use std::mem;

const MAX_MEMORY: usize = 100 * 1024 * 1024; // 100 MB

pub struct CappedHashMap {
    pub map: HashMap<String, Vec<u8>>,
    pub current_memory_usage: usize,
}

impl CappedHashMap {
    pub fn new() -> Self {
        CappedHashMap {
            map: HashMap::new(),
            current_memory_usage: 0,
        }
    }

    pub fn calculate_memory_usage(key: &str, value: &[u8]) -> usize {
        mem::size_of::<String>() + mem::size_of::<Vec<u8>>() + key.len() + value.len()
    }

    pub fn insert(&mut self, key: String, value: Vec<u8>) -> Result<(), &'static str> {
        let entry_size = Self::calculate_memory_usage(&key, &value);

        if self.current_memory_usage + entry_size > MAX_MEMORY {
            return Err("Memory limit exceeded");
        }

        // If the key already exists, remove its memory usage from the current memory usage
        if let Some(existing_value) = self.map.get(&key) {
            let existing_entry_size = Self::calculate_memory_usage(&key, existing_value);
            self.current_memory_usage -= existing_entry_size;
        }

        self.current_memory_usage += entry_size;
        self.map.insert(key, value);

        Ok(())
    }

    pub fn get(&self, key: &str) -> Option<&Vec<u8>> {
        self.map.get(key)
    }

    pub fn remove(&mut self, key: &str) -> Option<Vec<u8>> {
        if let Some(value) = self.map.remove(key) {
            let entry_size = Self::calculate_memory_usage(key, &value);
            self.current_memory_usage -= entry_size;
            Some(value)
        } else {
            None
        }
    }

    pub fn current_memory_usage(&self) -> usize {
        self.current_memory_usage
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_insert() {
        let mut capped_map = CappedHashMap::new();
        assert!(capped_map
            .insert("key1".to_string(), b"value1".to_vec())
            .is_ok());
        assert!(capped_map.get("key1").is_some());
        assert_eq!(capped_map.get("key1").unwrap(), &b"value1".to_vec());
    }

    #[test]
    fn test_insert_exceeding_limit() {
        let mut capped_map = CappedHashMap::new();
        let large_value = vec![0; MAX_MEMORY];
        assert!(capped_map.insert("key1".to_string(), large_value).is_err());
    }

    #[test]
    fn test_get() {
        let mut capped_map = CappedHashMap::new();
        capped_map
            .insert("key1".to_string(), b"value1".to_vec())
            .unwrap();
        assert_eq!(capped_map.get("key1"), Some(&b"value1".to_vec()));
        assert_eq!(capped_map.get("nonexistent_key"), None);
    }

    #[test]
    fn test_remove() {
        let mut capped_map = CappedHashMap::new();
        capped_map
            .insert("key1".to_string(), b"value1".to_vec())
            .unwrap();
        assert_eq!(capped_map.remove("key1"), Some(b"value1".to_vec()));
        assert_eq!(capped_map.get("key1"), None);
    }

    #[test]
    fn test_current_memory_usage() {
        let mut capped_map = CappedHashMap::new();
        let key = "key1".to_string();
        let value = b"value1".to_vec();
        let entry_size = CappedHashMap::calculate_memory_usage(&key, &value);
        capped_map.insert(key, value).unwrap();
        assert_eq!(capped_map.current_memory_usage(), entry_size);
    }

    #[test]
    fn test_calculate_memory_usage() {
        let key = "key1";
        let value = b"value1";
        let expected_size =
            mem::size_of::<String>() + mem::size_of::<Vec<u8>>() + key.len() + value.len();
        assert_eq!(
            CappedHashMap::calculate_memory_usage(key, value),
            expected_size
        );
    }
}
