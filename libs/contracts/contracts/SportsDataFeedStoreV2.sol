// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Mapping Arrays Sports Data Feed Storage
/// @notice Stores data feeds in a mapping of arrays
/// @dev This contract skips the usual function selector checks and uses a fallback function to set or get data feeds.
contract SportsDataFeedStoreV2 {
  /// @notice Mask for getFeedById(uint32 key)
  /// @dev The key is 32 bits. This mask uses 1 bit to determine if the function is a getter.
  /// The remaining 31 bits are used to store the key.
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR =
    0x0000000000000000000000000000000000000000000000000000000080000000;

  /// @notice Topic to be emitted when a data feed is set
  /// @dev keccak256("DataFeedSet(uint32, bytes32)")
  bytes32 internal constant EVENT_TOPIC =
    0xa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0;

  /// @notice Location of the mapping
  bytes32 internal constant MAPPING_LOCATION =
    0xF0000F000F000000000000000000000000000000000000000000000000000000;

  /// @notice Location of the array
  bytes32 internal constant ARRAY_LOCATION =
    0xF0000F000F000000000000000123400000000000000000000000000000000001;

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
        // Load how many slots to read from calldata
        let len := calldataload(0x04)

        // Key is the first 4 bytes of the calldata after the selector bit
        let key := and(selector, not(CONTRACT_MANAGEMENT_SELECTOR))

        // Get the address of the first free memory slot
        let ptr := mload(0x40)

        // Store the mapping location at memory location ptr[0]
        mstore(ptr, MAPPING_LOCATION)

        // Store key at memory location ptr[1]
        mstore(add(ptr, 0x20), key)

        // Store the array location at memory location ptr[2]
        mstore(add(ptr, 0x40), ARRAY_LOCATION)

        // Calculate the address of the mapping using keccak256 over ptr[0-2]
        let arrayAddress := keccak256(ptr, 0x60)

        // Loop through each slot
        for {
          let i := 0x00
        } lt(i, len) {
          i := add(i, 0x01)
        } {
          // Load the value from storage at array[i] and store it at memory location ptr[i]
          mstore(add(ptr, mul(i, 0x20)), sload(add(arrayAddress, i)))
        }

        // Return stored values at memory location ptr
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

        // Get the address of the first free memory slot
        let ptr := mload(0x40)

        // Get the length of the calldata
        let len := calldatasize()
        for {
          // Start at location 0x04 where first key is stored after the selector
          let i := 0x04
        } lt(i, len) {
          // Increment by 32 bytes to skip description
          i := add(i, 0x20)

          // Increment by 128 bytes to use new scratch space
          ptr := add(ptr, 0x80)
        } {
          // Store mapping location in memory at first slot of scratch space
          mstore(ptr, MAPPING_LOCATION)

          // Store key in memory at second slot of scratch space
          calldatacopy(add(ptr, 0x3C), i, 0x04)

          // Store array location in memory at third slot of scratch space
          mstore(add(ptr, 0x40), ARRAY_LOCATION)

          // Calculate the address of the mapping using keccak256 over ptr[0-2]
          let arrayElementsRegion := keccak256(ptr, 0x60)

          // Store slotsCount in memory at fourth slot of scratch space
          calldatacopy(add(ptr, 0x7E), add(i, 0x04), 0x02)
          let slotsCount := mload(add(ptr, 0x60))

          // Increment by 6 bytes to skip key & slotsCount
          i := add(i, 0x06)

          // Loop through each value in calldata
          for {
            let j := 0x00
          } lt(j, slotsCount) {
            j := add(j, 0x01)
          } {
            // Store value in storage at array[j]
            sstore(
              add(arrayElementsRegion, j),
              calldataload(add(i, mul(j, 0x20)))
            )
          }

          // Increment by 32 * slotsCount bytes to skip values in calldata
          i := add(i, mul(0x20, slotsCount))

          // Store description in memory at third slot of scratch space
          calldatacopy(add(ptr, 0x40), i, 0x20)

          // Emit event with key and description
          log1(add(ptr, 0x20), 0x40, EVENT_TOPIC)
        }
        return(0x00, 0x00)
      }
      revert(0x00, 0x00)
    }
  }
}
