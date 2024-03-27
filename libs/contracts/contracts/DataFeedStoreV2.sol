// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract DataFeedStoreV2 {
  /// @notice Mask for getFeedById(uint32 key)
  /// @dev The key is 32 bits. This mask uses 1 bit to determine if the function is a getter.
  /// The remaining 31 bits are used to store the key.
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR =
    0x0000000000000000000000000000000000000000000000000000000080000000;

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

    // getters
    assembly {
      // store selector in memory at location 0
      calldatacopy(28, 0, 4)
      selector := mload(0)

      // getFeedById(uint32 key) returns (bytes32)
      if and(selector, CONTRACT_MANAGEMENT_SELECTOR) {
        // store key in memory
        mstore(0x00, and(selector, not(CONTRACT_MANAGEMENT_SELECTOR)))
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
          // store key in memory at location 0x04
          calldatacopy(0x00, i, 0x04)
          // store value in mapping at slot = keccak256(key, location)
          sstore(keccak256(0x00, 5), calldataload(add(i, 0x04)))
        }
      }
    }
  }
}
