// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Mapping Data Feed Storage
/// @notice Stores data feeds in a mapping
/// @dev This contract skips the usual function selector checks and uses a fallback function to set or get data feeds.
contract DataFeedStoreV1 {
  /// @notice Mask for getFeedById(uint32 key)
  /// @dev The maximum length of the key is defined by the mask from the selector.
  /// If the selector is less than the mask, then the function is a getter and the selector holds the key.
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR =
    0x000000000000000000000000000000000000000000000000000000000001ffff;

  /// @notice Location of the data feed mapping
  /// @dev Each value is stored at a unique slot in the storage at keccak256(key, DATA_FEED_LOCATION)
  bytes32 internal constant DATA_FEED_LOCATION =
    0xf000000000000000000000000000000000000000000000000000000000000000;

  /// @notice Owner of the contract
  /// @dev The owner is the address that deployed the contract
  address internal immutable owner;

  /// @notice Constructor
  /// @dev Sets the owner of the contract - the address that deployed the contract
  constructor() {
    owner = msg.sender;
  }

  /// @notice Fallback function
  /// @dev The fallback function is used to set or get data feeds according to the provided selector.
  fallback() external {
    // Getters
    assembly {
      // Store selector in memory in the first memory slot
      calldatacopy(0x1C, 0x00, 0x04)

      // Load selector from memory
      let selector := mload(0x00)

      // getFeedById(uint32 key) returns (bytes32)
      if lt(selector, CONTRACT_MANAGEMENT_SELECTOR) {
        // Store mapping location in memory
        mstore(0x20, DATA_FEED_LOCATION)

        // Store value from mapping[slot = keccak256(key, location)] at memory location 0
        mstore(0x00, sload(keccak256(0x1C, 0x05)))

        // Return value stored at memory location 0
        return(0x00, 0x20)
      }
    }

    address _owner = owner;

    // Setters
    assembly {
      // Check if sender is owner
      if iszero(eq(_owner, caller())) {
        revert(0x00, 0x00)
      }

      // Load selector from memory
      let selector := mload(0x00)

      // setFeeds(bytes)
      if eq(selector, 0x1a2d80ac) {
        // Bytes should be in the format of:
        // <key1><value1>...<keyN><valueN>
        // where key is uint32 and value is bytes32

        // Store mapping location in memory at location 0x04
        mstore(0x04, DATA_FEED_LOCATION)

        let len := calldatasize()
        for {
          // Start at location 0x04 where first key is stored after the selector
          let i := 0x04
        } lt(i, len) {
          // Increment by 36 bytes (4 bytes for key and 32 bytes for value)
          i := add(i, 0x24)
        } {
          // Store key in memory at location 0x00
          calldatacopy(0x00, i, 0x04)

          // Store value in mapping at slot = keccak256(key, location)
          sstore(keccak256(0x00, 0x05), calldataload(add(i, 0x04)))
        }
        return(0x00, 0x00)
      }
      revert(0x00, 0x00)
    }
  }
}
