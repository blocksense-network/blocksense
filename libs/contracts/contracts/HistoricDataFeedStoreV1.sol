// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// array[key] -> array[counter] -> Transmission {bytes24 value, uint64 timestamp}

// Storage layout
//
// We have 2-D arrays where:
// - key is the feed id and array[key] is the array of counters;
// - counter is incremented whenever a new value for a feed is stored
//   and presents a continuous feed history.
// The first value at array[key][0] is the latest counter.
// The value at array[key][counter] is { value, timestamp }.
// The value is a bytes24, whereas the timestamp is a uint64.

/// @title Array of arrays Historic Data Feed Storage
contract HistoricDataFeedStoreV1 {
  // Combines all getter selector bits
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR_GETTER =
    0x00000000000000000000000000000000000000000000000000000000E0000000;
  // Used to get the latest feed
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_LATEST =
    0x0000000000000000000000000000000000000000000000000000000080000000;
  // Used to get the latest counter
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR_GET_LATEST_COUNTER =
    0x0000000000000000000000000000000000000000000000000000000040000000;
  // Used to get the feed at a specific counter
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_AT_COUNTER =
    0x0000000000000000000000000000000000000000000000000000000020000000;
  // Maximum counter value
  uint16 internal constant MAX_COUNTER = 0xFFFF;

  /// @notice Owner of the contract
  /// @dev The owner is the address that deployed the contract
  address internal immutable owner;

  constructor() {
    owner = msg.sender;
  }

  /// @notice Fallback function
  /// @dev The fallback function is used to set or get data feeds according to the provided selector.
  fallback() external {
    // getters
    assembly {
      // Store selector in memory at location 28
      calldatacopy(0x1C, 0x00, 0x04)
      let selector := mload(0x00)

      // Key is the first 4 bytes of the calldata after the selector
      let key := and(selector, not(CONTRACT_MANAGEMENT_SELECTOR_GETTER))

      // getFeedById(uint32 key) returns (bytes32 value)
      if and(selector, CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_LATEST) {
        let position := mul(key, MAX_COUNTER)
        // Load the latest counter at array[key]
        // Then load the value at array[key][counter] and store it at memory location 0
        mstore(0x00, sload(add(position, sload(position))))

        // Return value stored at memory location 0
        return(0x00, 0x20)
      }
      // getLatestCounter(uint32 key) returns (uint256 counter)
      if and(selector, CONTRACT_MANAGEMENT_SELECTOR_GET_LATEST_COUNTER) {
        // Load value at array[key] and store it at memory location 0
        mstore(0x00, sload(mul(key, MAX_COUNTER)))

        // Return value stored at memory location 0
        return(0x00, 0x20)
      }
      // getFeedAtCounter(uint32 key, uint256 counter) returns (bytes32 value)
      if and(selector, CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_AT_COUNTER) {
        let position := mul(key, MAX_COUNTER)
        // providedCounter is the bytes of the calldata after the selector (first 4 bytes)
        // Load value at array[key][providedCounter] and store it at memory location 0
        mstore(0x00, sload(add(position, calldataload(0x04))))

        // Return value stored at memory location 0
        return(0x00, 0x20)
      }
    }

    address _owner = owner;

    // setters
    assembly {
      // Check if sender is owner
      if iszero(eq(_owner, caller())) {
        revert(0, 0)
      }

      let selector := mload(0x00)

      // setFeeds(bytes)
      if eq(selector, 0x1a2d80ac) {
        // Bytes should be in the format of:
        // <key1><value1>...<keyN><valueN>
        // where key is uint32 and value is bytes32.
        let time := timestamp()
        let len := calldatasize()
        for {
          // Start at location 0x04 where first key is stored after the selector
          let i := 4
        } lt(i, len) {
          // Increment by 36 bytes (4 bytes for key and 32 bytes for value)
          i := add(i, 0x24)
        } {
          // Store key in memory at the last 4 bytes of the second slot 60-64
          calldatacopy(0x3C, i, 0x04)
          // Calculate the address of the first slot of array[key][0] which contains the latest counter
          let counterPos := mul(mload(0x20), MAX_COUNTER)
          // Load the latest counter and increment it by 1
          let currentCounter := addmod(sload(counterPos), 1, MAX_COUNTER)
          // To avoid getting a zero value in storage when reset to zero,
          // the counter is always one greater than the actual value.
          // This prevents a higher gas cost when the value is incremented again.
          if iszero(currentCounter) {
            currentCounter := 1
          }

          // Store the new counter in storage at array[key][0]
          sstore(counterPos, currentCounter)

          // Store { value, timestamp } at array[key][counter]
          sstore(
            add(counterPos, currentCounter),
            or(calldataload(add(i, 0x04)), time)
          )
        }
        return(0, 0)
      }
      // Revert if selector is not recognized
      revert(0, 0)
    }
  }
}
