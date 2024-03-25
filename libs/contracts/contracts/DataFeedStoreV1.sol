// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract DataFeedStoreV1 {
  bytes4 internal constant CONTRACT_MANAGEMENT_SELECTOR = 0x000000ff;
  uint8 internal constant DATA_FEED_LOCATION = 0x01;

  // Fallback function to store dataFeeds
  fallback(bytes calldata data) external returns (bytes memory) {
    bytes4 selector = bytes4(data[:4]);

    if (selector < CONTRACT_MANAGEMENT_SELECTOR) {
      assembly {
        calldatacopy(0, 0, 0x04)
        mstore(0x04, DATA_FEED_LOCATION)
        mstore(0, sload(keccak256(0, 0x05)))
        return(0, 0x20)
      }
    } else {
      if (selector == 0x1a2d80ac) {
        // setFeeds(bytes)
        // bytes should be in the format of:
        // <key1><value1>...<keyN><valueN>
        // where key is uint32 and value is bytes32
        assembly {
          let len := calldatasize()
          for {
            let i := 4
          } lt(i, len) {
            i := add(i, 0x24)
          } {
            calldatacopy(0, i, 0x04)
            mstore(0x04, DATA_FEED_LOCATION)

            calldatacopy(0x10, add(i, 0x04), 0x20)
            sstore(keccak256(0, 0x05), mload(0x10))
          }
        }
      }
    }
  }
}
