// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SportsDataFeedStoreV2 {
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR =
    0x0000000000000000000000000000000000000000000000000000000080000000;
  bytes32 internal constant EVENT_TOPIC =
    0xa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0;

  bytes32 internal constant MAPPING_LOCATION =
    0xF0000F000F000000000000000000000000000000000000000000000000000000;
  bytes32 internal constant ARRAY_LOCATION =
    0xF0000F000F000000000000000123400000000000000000000000000000000001;

  address internal immutable owner;

  constructor() {
    owner = msg.sender;
  }

  // Fallback function
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

        mstore(ptr, MAPPING_LOCATION)
        mstore(add(ptr, 0x20), key)
        mstore(add(ptr, 0x40), ARRAY_LOCATION)

        let arrayAddress := keccak256(ptr, 0x60)

        for {
          let i := 0x00
        } lt(i, len) {
          i := add(i, 0x01)
        } {
          // Load value at array[key] and store it at memory location i
          mstore(add(ptr, mul(i, 0x20)), sload(add(arrayAddress, i)))
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
        // where key is uint32, value is bytes32 and description is bytes32

        let ptr := mload(0x40)
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
          // Store mapping location in memory
          mstore(ptr, MAPPING_LOCATION)
          // Store key in memory at slot 60
          calldatacopy(add(ptr, 0x3C), i, 0x04)
          // Store array location in memory at slot 64
          mstore(add(ptr, 0x40), ARRAY_LOCATION)

          // Calculate array address at map[key]
          let arrayElementsRegion := keccak256(ptr, 0x60)

          // Store slotsCount in memory at slot 126
          calldatacopy(add(ptr, 0x7E), add(i, 0x04), 0x02)
          let slotsCount := mload(add(ptr, 0x60))

          // Increment by 6 bytes to skip key & slotsCount
          i := add(i, 0x06)

          for {
            let j := 0x00
          } lt(j, slotsCount) {
            j := add(j, 0x01)
          } {
            // Store value in storage at slot key (index)
            sstore(
              add(arrayElementsRegion, j),
              calldataload(add(i, mul(j, 0x20)))
            )
          }

          // Increment by 32 * slotsCount bytes to skip value
          i := add(i, mul(0x20, slotsCount))

          mstore(add(ptr, 0x40), 0)
          // Store description in memory at location 0x40
          calldatacopy(add(ptr, 0x40), i, 0x20)

          // Emit event
          log1(add(ptr, 0x20), 0x40, EVENT_TOPIC)
        }
        return(0x00, 0x00)
      }
      revert(0x00, 0x00)
    }
  }
}
