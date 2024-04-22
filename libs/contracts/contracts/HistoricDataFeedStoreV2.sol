// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// mapping(key => mapping(counter => Transmission {bytes24 value, uint64 timestamp}))

/// @title Mapping of mappings Historic Data Feed Storage
contract HistoricDataFeedStoreV2 {
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_LATEST =
    0x0000000000000000000000000000000000000000000000000000000080000000;
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR_GET_LATEST_COUNTER =
    0x0000000000000000000000000000000000000000000000000000000040000000;
  bytes32 internal constant CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_AT_COUNTER =
    0x0000000000000000000000000000000000000000000000000000000020000000;
  // keccak256('storage.denominator')
  bytes28 internal constant STORAGE_DENOMINATOR =
    0x8d8daa6442c3d9476042ba09026f2d97248b893c551e8cf6f18eac97;
  uint16 internal constant MAX_COUNTER = 0xFFFF;

  /// @notice Owner of the contract
  /// @dev The owner is the address that deployed the contract
  address internal immutable owner;

  constructor() {
    owner = msg.sender;
  }

  /// @notice Fallback function
  /// @dev The fallback function is used to set or get data feeds according to the provided selector.
  fallback(bytes calldata) external returns (bytes memory) {
    bytes32 selector;
    uint64 callDataSize;

    // getters
    assembly {
      // store selector in memory at location 28
      calldatacopy(0x1C, 0x00, 0x04)
      selector := mload(0x00)
      callDataSize := calldatasize()

      // no getter msg.data can be longer than 36 bytes
      if lt(callDataSize, 37) {
        function getKey(data, contractManagementConstant) -> key {
          key := and(data, not(contractManagementConstant))
        }

        // getFeedById(uint32 key) returns (bytes32)
        if and(selector, CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_LATEST) {
          let key := getKey(
            selector,
            CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_LATEST
          )

          mstore(0x00, key)
          mstore(0x20, add(STORAGE_DENOMINATOR, shl(32, sload(key))))
          mstore(0x00, sload(keccak256(0x1C, 0x20)))

          // return value stored at memory location 0
          return(0x00, 0x20)
        }
        // getLatestCounter(uint32 key) returns (uint16)
        if and(selector, CONTRACT_MANAGEMENT_SELECTOR_GET_LATEST_COUNTER) {
          let key := getKey(
            selector,
            CONTRACT_MANAGEMENT_SELECTOR_GET_LATEST_COUNTER
          )

          mstore(0x00, sload(key))

          // return value stored at memory location 0
          return(0x00, 0x20)
        }
        // getFeedAtCounter(uint32 key, uint16 counter) returns (bytes32)
        if and(selector, CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_AT_COUNTER) {
          let key := getKey(
            selector,
            CONTRACT_MANAGEMENT_SELECTOR_GET_FEED_AT_COUNTER
          )

          mstore(0x00, key)
          mstore(0x20, add(STORAGE_DENOMINATOR, shl(32, calldataload(0x04))))
          mstore(0x00, sload(keccak256(0x1C, 0x20)))

          // return value stored at memory location 0
          return(0x00, 0x20)
        }
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
        result := eq(
          or(
            lt(incomingSelector, predefinedSelector),
            gt(incomingSelector, predefinedSelector)
          ),
          0
        )
      }

      // setFeeds(bytes)
      if compareSelectors(selector, 0x1a2d80ac) {
        // bytes should be in the format of:
        // <key1><value1>...<keyN><valueN>
        // where key is uint32 and value is bytes32
        let time := timestamp()
        for {
          // start at location 0x04 where first key is stored after the selector
          let i := 4
        } lt(i, callDataSize) {
          // increment by 36 bytes (4 bytes for key and 32 bytes for value)
          i := add(i, 0x24)
        } {
          // store key in memory at the last 4 bytes of the second slot 60-64
          calldatacopy(0x1C, i, 0x04)
          let key := mload(0x00)
          let counter := sload(key)
          let currentCounter := addmod(counter, 1, MAX_COUNTER)
          if iszero(currentCounter) {
            currentCounter := 1
          }

          // store new counter value
          sstore(key, currentCounter)
          mstore(0x20, add(STORAGE_DENOMINATOR, shl(32, currentCounter)))

          // store value
          sstore(keccak256(0x1C, 0x20), or(calldataload(add(i, 0x04)), time))
        }
        return(0, 0)
      }
      revert(0, 0)
    }
  }
}
