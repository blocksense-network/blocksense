// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract DataFeedStoreV1 {
  /// @notice Mask for getFeedById(uint32 key)
  /// @dev The maximum length of the key is defined by the mask from the selector.
  /// If the selector is less than the mask, then the function is a getter and the selector holds the key.
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR =
    0x00000000000000000000000000000000000000000000000000000000000001ff;

  /// @notice Location of the data feed mapping
  /// @dev Each value is stored at a unique slot in the storage at keccak256(key, DATA_FEED_LOCATION)
  bytes32 internal constant DATA_FEED_LOCATION =
    0xf000000000000000000000000000000000000000000000000000000000000000;

  /// @notice Owner of the contract
  /// @dev The owner is the address that deployed the contract
  address internal immutable owner;

  constructor() {
    owner = msg.sender;
  }

  // Fallback function to manage dataFeeds mapping
  fallback(bytes calldata) external returns (bytes memory) {
    bytes32 selector;

    assembly {
      // store selector in memory in the first memory slot
      calldatacopy(28, 0, 4)
      // load selector from memory
      selector := mload(0)

      // getFeedById(uint32 key) returns (bytes32)
      if lt(selector, CONTRACT_MANAGEMENT_SELECTOR) {
        // store mapping location in memory
        mstore(0x20, DATA_FEED_LOCATION)
        // store value from mapping[slot = keccak256(key, location)] at memory location 0
        mstore(0, sload(keccak256(28, 5)))
        // return value stored at memory location 0
        return(0, 0x20)
      }
    }

    address _owner = owner;

    // setters
    assembly {
      // check if sender is owner
      if iszero(eq(_owner, caller())) {
        revert(0, 0)
      }

      // setFeeds(bytes)
      if and(selector, 0x1a2d80ac) {
        // bytes should be in the format of:
        // <key1><value1>...<keyN><valueN>
        // where key is uint32 and value is bytes32

        // store mapping location in memory at location 0x04
        mstore(0x04, DATA_FEED_LOCATION)

        let len := calldatasize()
        for {
          // start at location 0x04 where first key is stored after the selector
          let i := 4
        } lt(i, len) {
          // increment by 36 bytes (4 bytes for key and 32 bytes for value)
          i := add(i, 0x24)
        } {
          // store key in memory at location 0x00
          calldatacopy(0, i, 0x04)
          // store value in mapping at slot = keccak256(key, location)
          sstore(keccak256(0, 5), calldataload(add(i, 0x04)))
        }
      }
    }
  }
}
