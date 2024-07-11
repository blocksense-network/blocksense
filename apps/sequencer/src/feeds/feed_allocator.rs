use alloy::primitives::Address;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

pub struct Allocation {
    contract_address: Address,
    storage_index: u32,
    number_of_slots: u8,
    schema_id: Uuid,
    allocation_timestamp: DateTime<Utc>,
    voting_start_timestamp: DateTime<Utc>,
    voting_end_timestamp: DateTime<Utc>,
}

impl Allocation {
    pub fn new(
        contract_address: Address,
        storage_index: u32,
        number_of_slots: u8,
        schema_id: Uuid,
        allocation_timestamp: DateTime<Utc>,
        voting_start_timestamp: DateTime<Utc>,
        voting_end_timestamp: DateTime<Utc>,
    ) -> Result<Self, String> {
        let allocation = Self {
            contract_address,
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

/// A single-threaded version of an Allocator for indexes
pub struct Allocator {
    space_lower_bound: u32,
    space_upper_bound: u32,
    allocations: HashMap<u32, Allocation>,
}

impl Allocator {
    pub fn new(space: std::ops::RangeInclusive<u32>) -> Allocator {
        // TODO: validate range is in u32 space
        Allocator {
            space_lower_bound: space.start().clone(),
            space_upper_bound: space.end().clone(),
            allocations: HashMap::new(),
        }
    }

    pub fn space_size(&self) -> u32 {
        let space_size: u32 = self.space_upper_bound - self.space_lower_bound + 1;
        return space_size;
    }

    pub fn num_allocated_indexes(&self) -> u32 {
        let num_allocated_indexes = self.allocations.len();
        return num_allocated_indexes as u32;
    }

    pub fn num_free_indexes(&self) -> u32 {
        let num_free_indexes = self.space_size() - self.num_allocated_indexes();
        return num_free_indexes;
    }

    pub fn allocate(
        &mut self,
        contract_address: Address,
        number_of_slots: u8,
        schema_id: Uuid,
        voting_start_timestamp: DateTime<Utc>,
        voting_end_timestamp: DateTime<Utc>,
    ) -> Result<u32, String> {
        // generate Allocation index
        // get free slot
        // if no free slot get the oldest expired slot
        let free_index: u32 = self
            .get_free_index()
            .or_else(|_| self.get_expired_index())?;

        // generate allocation_timestamp: DateTime<Utc>,
        let now: DateTime<Utc> = Utc::now();

        // generate Allocation
        let allocation = Allocation::new(
            contract_address,
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
        return Ok(free_index);
    }

    fn get_free_index(&self) -> Result<u32, &str> {
        let result = (self.space_lower_bound..=self.space_upper_bound)
            .find(|index| !self.allocations.contains_key(index))
            .ok_or("no free space");
        return result;
    }

    fn get_expired_index(&self) -> Result<u32, &str> {
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
        return result;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feeds::feed_allocator::Allocator;
    use alloy::primitives::{address, Address};
    use chrono::{DateTime, TimeDelta, Utc};
    use std::ops::Add;
    use std::thread::sleep;
    use std::time::Duration;

    #[test]
    fn test_allocation_get_free_index() {
        // setup
        let allocator: Allocator = Allocator::new((1..=5));

        // run
        let free_index = allocator.get_free_index();

        // assert
        assert!(free_index.is_ok_and(|index| index == 1));
    }

    #[test]
    fn test_allocation_get_expired_index() {
        // setup
        let contract_address: Address = address!("66f9664f97F2b50F62D13eA064982f936dE76657");
        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: TimeDelta = TimeDelta::new(10, 0).unwrap();
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);
        let mut allocator: Allocator = Allocator::new((1..=5));
        let allocation1 = allocator.allocate(
            contract_address,
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
        let mut allocator: Allocator = Allocator::new((1..=5));

        // assert
        assert_eq!(allocator.space_size(), 5);
        assert_eq!(allocator.num_free_indexes(), 5);
        assert_eq!(allocator.num_allocated_indexes(), 0);

        // allocate 1 slot
        let contract_address: Address = address!("66f9664f97F2b50F62D13eA064982f936dE76657");
        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: TimeDelta = TimeDelta::new(10, 0).unwrap();
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);
        let allocate_request_1 = allocator.allocate(
            contract_address,
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
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        let _ = allocator.allocate(
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        let _ = allocator.allocate(
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        let _ = allocator.allocate(
            contract_address,
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
        let contract_address: Address = address!("66f9664f97F2b50F62D13eA064982f936dE76657");
        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: TimeDelta = TimeDelta::new(10, 0).unwrap();
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);
        let mut allocator: Allocator = Allocator::new((1..=5));

        // run
        let result = allocator.allocate(
            contract_address,
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
        let mut allocator: Allocator = Allocator::new((1..=5));

        // assert
        assert_eq!(allocator.space_size(), 5);
        assert_eq!(allocator.num_free_indexes(), 5);
        assert_eq!(allocator.num_allocated_indexes(), 0);

        // allocate 1 slot
        let contract_address: Address = address!("66f9664f97F2b50F62D13eA064982f936dE76657");
        let number_of_slots: u8 = 1;
        let schema_id: Uuid = Uuid::parse_str("a1a2a3a4b1b2c1c2d1d2d3d4d5d6d7d8").unwrap();
        let voting_start_timestamp: DateTime<Utc> = Utc::now();
        let ten_seconds: TimeDelta = TimeDelta::new(10, 0).unwrap();
        let voting_end_timestamp: DateTime<Utc> = voting_start_timestamp.add(ten_seconds);
        let allocate_request_1 = allocator.allocate(
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_1.is_ok_and(|index| index == 1));

        // run
        let num_free_indexes = allocator.num_free_indexes();

        // fill space
        let allocate_request_2 = allocator.allocate(
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_2.is_ok_and(|index| index == 2));

        let allocate_request_3 = allocator.allocate(
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_3.is_ok_and(|index| index == 3));

        let allocate_request_4 = allocator.allocate(
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_4.is_ok_and(|index| index == 4));

        let allocate_request_5 = allocator.allocate(
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        assert!(allocate_request_5.is_ok_and(|index| index == 5));

        // space is full and no expired allocates
        let allocate_request_6 = allocator.allocate(
            contract_address,
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
            contract_address,
            number_of_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );

        // assert
        assert!(allocate_request_7.is_ok_and(|index| index == 1));
    }
}
