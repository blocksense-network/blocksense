use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

/// An Allocation is a representation of an allocated storage slot in a Solidity smart contract.
#[allow(dead_code)]
pub struct Allocation {
    storage_index: u128,
    number_of_slots: u8,
    schema_id: Uuid,
    allocation_timestamp: DateTime<Utc>,
    voting_start_timestamp: DateTime<Utc>,
    voting_end_timestamp: DateTime<Utc>,
}

impl Allocation {
    pub fn new(
        storage_index: u128,
        number_of_slots: u8,
        schema_id: Uuid,
        allocation_timestamp: DateTime<Utc>,
        voting_start_timestamp: DateTime<Utc>,
        voting_end_timestamp: DateTime<Utc>,
    ) -> Result<Self, String> {
        let allocation = Self {
            storage_index,
            number_of_slots,
            schema_id,
            allocation_timestamp,
            voting_start_timestamp,
            voting_end_timestamp,
        };

        allocation.validate()?;

        Ok(allocation)
    }

    fn validate(&self) -> Result<(), &str> {
        if self.voting_start_timestamp >= self.voting_end_timestamp {
            return Err("Voting start time must be before voting end time");
        }
        if self.allocation_timestamp > Utc::now() {
            return Err("Allocation timestamp cannot be in the future");
        }
        Ok(())
    }
}

/// A single-threaded version of an Allocator for indexes in the range [lower_bound; upper_bound].
///
/// When allocation is needed it starts from lower to upper bound until a free index is found.
/// If no free index has been found, it iterates from lower to upper bound
/// until an expired index is found and returns is.
pub struct Allocator {
    space_lower_bound: u128,
    space_upper_bound: u128,
    allocations: HashMap<u128, Allocation>,
}

impl Allocator {
    pub fn new(space: std::ops::RangeInclusive<u128>) -> Allocator {
        Allocator {
            space_lower_bound: *space.start(),
            space_upper_bound: *space.end(),
            allocations: HashMap::new(),
        }
    }

    pub fn space_size(&self) -> u128 {
        let space_size: u128 = self.space_upper_bound - self.space_lower_bound + 1;
        space_size
    }

    pub fn num_allocated_indexes(&self) -> u128 {
        let num_allocated_indexes = self.allocations.len();
        num_allocated_indexes as u128
    }

    pub fn num_free_indexes(&self) -> u128 {
        self.space_size() - self.num_allocated_indexes()
    }

    /// Creates an Allocation object with the provided parameters, finds an availiable index
    /// to store it in the internal allocations hashmap and returns the index to the called.
    /// Returns an error if no available index was found
    pub fn allocate(
        &mut self,
        number_of_slots: u8,
        schema_id: Uuid,
        voting_start_timestamp: DateTime<Utc>,
        voting_end_timestamp: DateTime<Utc>,
    ) -> Result<u128, String> {
        // generate Allocation index
        // get free slot
        // if no free slot get the oldest expired slot
        let free_index: u128 = self
            .get_free_index()
            .or_else(|_| self.get_expired_index())?;

        // generate allocation_timestamp: DateTime<Utc>,
        let now: DateTime<Utc> = Utc::now();

        // generate Allocation
        let allocation = Allocation::new(
            free_index,
            number_of_slots,
            schema_id,
            now,
            voting_start_timestamp,
            voting_end_timestamp,
        )?;
        self.allocations.insert(free_index, allocation);
        // put allocation into hashmap
        // return index
        Ok(free_index)
    }

    fn get_free_index(&self) -> Result<u128, &str> {
        (self.space_lower_bound..=self.space_upper_bound)
            .find(|index| !self.allocations.contains_key(index))
            .ok_or("no free space")
    }

    fn get_expired_index(&self) -> Result<u128, &str> {
        let now: DateTime<Utc> = Utc::now();
        let current_time_ms = now.timestamp_millis();
        let result = (self.space_lower_bound..=self.space_upper_bound)
            .find(|index| {
                self.allocations.contains_key(index)
                    && (self
                        .allocations
                        .get(index)
                        .unwrap()
                        .voting_end_timestamp
                        .timestamp_millis()
                        < current_time_ms)
            })
            .ok_or("it hit the fan");
        result
    }
}

pub fn init_concurrent_allocator() -> ConcurrentAllocator {
    // read from persistent storage if available
    // read range bounds from config file
    ConcurrentAllocator::new(1000..=2000)
}

pub struct ConcurrentAllocator {
    allocator: Arc<RwLock<Allocator>>,
}

/// A concurrent version of an Allocator.
impl ConcurrentAllocator {
    pub fn new(space: std::ops::RangeInclusive<u128>) -> Self {
        Self {
            allocator: Arc::new(RwLock::new(Allocator::new(space))),
        }
    }

    pub fn allocate(
        &self,
        number_of_slots: u8,
        schema_id: Uuid,
        voting_start_timestamp: DateTime<Utc>,
        voting_end_timestamp: DateTime<Utc>,
    ) -> Result<u128, String> {
        let mut allocator = self.allocator.write().unwrap();
        allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        )
    }

    pub fn space_size(&self) -> u128 {
        let allocator = self.allocator.read().unwrap();
        allocator.space_size()
    }

    pub fn num_allocated_indexes(&self) -> u128 {
        let allocator = self.allocator.read().unwrap();
        allocator.num_allocated_indexes()
    }

    pub fn num_free_indexes(&self) -> u128 {
        let allocator = self.allocator.read().unwrap();
        allocator.num_free_indexes()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feeds::feed_allocator::Allocator;
    use chrono::{DateTime, TimeDelta, Utc};
    use std::ops::Add;
    use std::sync::Arc;
    use std::thread;
    use std::thread::sleep;
    use std::time::Duration;

    #[test]
    fn test_allocation_get_free_index() {
        // setup
        let allocator: Allocator = Allocator::new(1..=5);

        // run
        let free_index = allocator.get_free_index();

        // assert
        assert!(free_index.is_ok_and(|index| index == 1));
    }

    #[test]
    fn test_allocation_get_expired_index() {
        // setup
        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: TimeDelta = TimeDelta::new(10, 0).unwrap();
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);
        let mut allocator: Allocator = Allocator::new(1..=5);
        let _allocation1 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );

        // run
        let result = allocator.get_expired_index();

        // assert - there is no expired result yet
        assert!(result.is_err());

        sleep(Duration::from_secs(11));

        // run
        let result = allocator.get_expired_index();

        // assert - now we have expired index
        assert!(result.is_ok());
    }

    #[test]
    fn test_allocation_num_free_and_allocated_indexes() {
        // setup
        let mut allocator: Allocator = Allocator::new(1..=5);

        // assert
        assert_eq!(allocator.space_size(), 5);
        assert_eq!(allocator.num_free_indexes(), 5);
        assert_eq!(allocator.num_allocated_indexes(), 0);

        // allocate 1 slot
        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: TimeDelta = TimeDelta::new(10, 0).unwrap();
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);
        let allocate_request_1 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_1.is_ok());

        // assert
        assert_eq!(allocator.space_size(), 5);
        assert_eq!(allocator.num_free_indexes(), 4);
        assert_eq!(allocator.num_allocated_indexes(), 1);

        // fill space
        let _ = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        let _ = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        let _ = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        let _ = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );

        // assert
        assert_eq!(allocator.space_size(), 5);
        assert_eq!(allocator.num_free_indexes(), 0);
        assert_eq!(allocator.num_allocated_indexes(), 5);
    }

    #[test]
    fn test_allocation_free_space() {
        // setup
        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: TimeDelta = TimeDelta::new(10, 0).unwrap();
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);
        let mut allocator: Allocator = Allocator::new(1..=5);

        // run
        let result = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );

        // assert
        assert!(result.is_ok_and(|index| index == 1));
    }

    #[test]
    fn test_allocation_space_full() {
        // We test the following scenario.
        // The allocator correctly allocates the free slots until available.
        // Then allocation returns an error where no free and no expired slots.
        // Then we wait until there are expired slots we can allocate.
        // Then allocator correctly returns expired slot.

        // setup
        let mut allocator: Allocator = Allocator::new(1..=5);

        // assert
        assert_eq!(allocator.space_size(), 5);
        assert_eq!(allocator.num_free_indexes(), 5);
        assert_eq!(allocator.num_allocated_indexes(), 0);

        // allocate 1 slot
        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: TimeDelta = TimeDelta::new(10, 0).unwrap();
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);
        let allocate_request_1 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_1.is_ok_and(|index| index == 1));

        // run
        let _num_free_indexes = allocator.num_free_indexes();

        // fill space
        let allocate_request_2 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_2.is_ok_and(|index| index == 2));

        let allocate_request_3 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_3.is_ok_and(|index| index == 3));

        let allocate_request_4 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_4.is_ok_and(|index| index == 4));

        let allocate_request_5 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_5.is_ok_and(|index| index == 5));

        // space is full and no expired allocates
        let allocate_request_6 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );

        // assert
        assert!(allocate_request_6.is_err());

        // wait for an allocation to become expired
        sleep(Duration::from_secs(11));

        // allocate
        let allocate_request_7 = allocator.allocate(
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );

        // assert
        assert!(allocate_request_7.is_ok_and(|index| index == 1));
    }

    #[test]
    fn test_concurrent_allocator_allocation() {
        let allocator = Arc::new(ConcurrentAllocator::new(1..=5));

        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: Duration = Duration::from_secs(10);
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);

        let handles: Vec<_> = (0..5)
            .map(|_| {
                let allocator = Arc::clone(&allocator);
                thread::spawn(move || {
                    allocator.allocate(
                        number_of_slots,
                        schema_id,
                        voting_start_timestamp,
                        voting_end_timestamp,
                    )
                })
            })
            .collect();

        for handle in handles {
            let result = handle.join().unwrap();
            assert!(result.is_ok());
        }

        assert_eq!(allocator.space_size(), 5);
        assert_eq!(allocator.num_free_indexes(), 0);
        assert_eq!(allocator.num_allocated_indexes(), 5);
    }
}
