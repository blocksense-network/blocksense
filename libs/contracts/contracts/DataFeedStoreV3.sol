// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

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

  // Fallback function to manage dataFeeds mapping
  fallback(bytes calldata) external returns (bytes memory) {
    bytes32 selector;
    // getters
    assembly {
      // store selector in memory at location 0
      calldatacopy(0x1C, 0x00, 0x04)
      selector := mload(0x00)

      // getFeedById(uint32 key) returns (bytes32)
      if and(selector, CONTRACT_MANAGEMENT_SELECTOR) {
        // store key in memory
        mstore(0x20, and(selector, not(CONTRACT_MANAGEMENT_SELECTOR)))
        // load value at array[key] and store it at memory location 0
        mstore(0x00, sload(mload(0x20)))
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

      // setFeeds(bytes)
      if and(selector, 0x1a2d80ac) {
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
      }
    }
  }
}
