// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract DataFeedStoreV3 {
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR =
    0x8000000000000000000000000000000000000000000000000000000000000000;
  bytes32 internal constant DATA_FEED_LOCATION =
    0xf000000000000000000000000000000000000000000000000000000000000000;
  address internal immutable owner;

  constructor() {
    owner = msg.sender;
  }

  // Fallback function to store dataFeeds
  fallback(bytes calldata) external returns (bytes memory) {
    bytes32 selector;

    // getters
    assembly {
      // store selector in memory at location 0
      calldatacopy(0, 0, 0x04)
      selector := mload(0)

      if and(selector, CONTRACT_MANAGEMENT_SELECTOR) {
        // getFeedById(uint32 key) returns (bytes32)
        // store key in memory
        mstore(0x04, and(selector, not(CONTRACT_MANAGEMENT_SELECTOR)))
        // store mapping location in memory
        mstore(0x08, DATA_FEED_LOCATION)
        // store value from mapping[slot = keccak256(key, location)] at memory location 0
        mstore(0, sload(keccak256(0x04, 5)))
        // return value
        return(0, 0x20)
      }
    }
    // setters

    address _owner = owner;
    // setters
    assembly {
      // check if sender is owner
      if iszero(eq(_owner, caller())) {
        revert(0, 0)
      }

      if and(
        selector,
        0x1a2d80ac00000000000000000000000000000000000000000000000000000000
      ) {
        // setFeeds(bytes)

        // bytes should be in the format of:
        // <key1><value1>...<keyN><valueN>
        // where key is uint32 and value is bytes32

        // store mapping location in memory at location 0x08
        mstore(0x08, DATA_FEED_LOCATION)

        let len := calldatasize()
        for {
          let i := 4
        } lt(i, len) {
          i := add(i, 0x24)
        } {
          // store key in memory at location 0x04
          calldatacopy(4, i, 0x04)

          // store value in mapping at slot = keccak256(key, location)
          sstore(keccak256(0x04, 5), calldataload(add(i, 0x04)))
        }
      }
    }
  }
}
