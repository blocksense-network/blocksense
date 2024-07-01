// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Array Data Feed Storage
/// @notice Stores data feeds in an array
/// @dev This contract skips the usual function selector checks and uses a fallback function to set or get data feeds.
contract SportsDataFeedStoreV1 {
  /// @notice Mask for getFeedById(uint32 key)
  /// @dev The key is 32 bits. This mask uses 1 bit to determine if the function is a getter.
  /// The remaining 31 bits are used to store the key.
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR =
    0x0000000000000000000000000000000000000000000000000000000080000000;
  /// @notice Topic to be emitted when a data feed is set
  /// @dev keccak256("DataFeedSet(uint32 key, bytes32 description)")
  bytes32 internal constant EVENT_TOPIC =
    0xa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0;

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
      // Store selector in memory at location 0
      calldatacopy(0x1C, 0x00, 0x04)

      // Load selector from memory
      let selector := mload(0x00)

      // getFeedById(uint32 key, uint256 len) returns (bytes32)
      if and(selector, CONTRACT_MANAGEMENT_SELECTOR) {
        let len := calldataload(0x04)
        let key := and(selector, not(CONTRACT_MANAGEMENT_SELECTOR))
        let ptr := mload(0x40)

        for {
          let i := 0x00
        } lt(i, len) {
          i := add(i, 0x01)
        } {
          // Load value at array[key] and store it at memory location i
          mstore(add(ptr, mul(i, 0x20)), sload(add(key, i)))
        }

        // Return stored value
        return(ptr, mul(len, 0x20))
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
        // <key1><slotsCount1><value1><description1>...<keyN><slotsCountN><valueN><descriptionN>
        // where key is uint32, slots count is uint16, value is bytes32 and description is bytes32

        let ptr := mload(0x40)
        let len := calldatasize()
        for {
          // Start at location 0x04 where first key is stored after the selector
          let i := 0x04
        } lt(i, len) {
          // Increment by 32 bytes to skip description
          i := add(i, 0x20)
          // Increment by 64 bytes to use new scratch space
          ptr := add(ptr, 0x40)
        } {
          // Store key in memory at slot 0x1C
          calldatacopy(add(ptr, 0x1C), i, 0x04)

          // Store slotsCount in memory at slot 62
          calldatacopy(add(ptr, 0x3E), add(i, 0x04), 0x02)
          let slotsCount := mload(add(ptr, 0x20))

          // Increment by 6 bytes to skip key & slotsCount
          i := add(i, 0x06)

          for {
            let j := 0x00
          } lt(j, slotsCount) {
            j := add(j, 0x01)
          } {
            // Store value in storage at slot key (index)
            sstore(add(mload(ptr), j), calldataload(add(i, mul(0x20, j))))
          }

          // Increment by 32 * slotsCount bytes to skip value
          i := add(i, mul(0x20, slotsCount))

          // Store description in memory at location 0x20
          calldatacopy(add(ptr, 0x20), i, 0x20)

          // Emit event
          log1(ptr, 0x40, EVENT_TOPIC)
        }
        return(0x00, 0x00)
      }
      revert(0x00, 0x00)
    }
  }
}
