// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title Array Data Feed Storage
/// @notice Stores data feeds in an array
/// @dev This contract skips the usual function selector checks and uses a fallback function to set or get data feeds.
contract DataFeedStoreV3 {
  /// @notice Mask for getFeedById(uint32 key)
  /// @dev The key is 32 bits. This mask uses 1 bit to determine if the function is a getter.
  /// The remaining 31 bits are used to store the key.
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR =
    0x0000000000000000000000000000000000000000000000000000000080000000;

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
      // store selector in memory at location 0
      calldatacopy(0x1C, 0x00, 0x04)
      let selector := mload(0x00)

      // getFeedById(uint32 key) returns (bytes32)
      if and(selector, CONTRACT_MANAGEMENT_SELECTOR) {
        // load value at array[key] and store it at memory location 0
        mstore(0x00, sload(and(selector, not(CONTRACT_MANAGEMENT_SELECTOR))))
        // return value stored at memory location 0
        return(0x00, 0x20)
      }
    }

    address _owner = owner;

    // setters
    assembly {
      // check if sender is owner
      if iszero(eq(_owner, caller())) {
        revert(0, 0)
      }

      // consumes less gas than a simple equality check
      function compareSelectors(incomingSelector, predefinedSelector)
        -> result
      {
        result := iszero(
          or(
            lt(incomingSelector, predefinedSelector),
            gt(incomingSelector, predefinedSelector)
          )
        )
      }

      let selector := mload(0)

      // setFeeds(bytes)
      if compareSelectors(selector, 0x1a2d80ac) {
        // bytes should be in the format of:
        // <key1><value1>...<keyN><valueN>
        // where key is uint32 and value is bytes32

        let len := calldatasize()
        for {
          // start at location 0x04 where first key is stored after the selector
          let i := 4
        } lt(i, len) {
          // increment by 36 bytes (4 bytes for key and 32 bytes for value)
          i := add(i, 0x24)
        } {
          // store key in memory at slot 0x20
          calldatacopy(0x3C, i, 0x04)
          // store value in storage at slot key (index)
          sstore(mload(0x20), calldataload(add(i, 0x04)))
        }
        return(0, 0)
      }
      revert(0, 0)
    }
  }
}
