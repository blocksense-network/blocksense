// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
import 'hardhat/console.sol';

contract DataFeedStoreV2 {
  uint8 public constant DATA_FEED_LOCATION = 0x00;
  bytes32 public constant CONTRACT_MANAGEMENT_SELECTOR =
    0x8000000000000000000000000000000000000000000000000000000000000000;

  // Fallback function to store dataFeeds
  fallback(bytes calldata) external returns (bytes memory) {
    uint gasStart = gasleft();

    assembly {
      calldatacopy(0, 0, 0x04)
      let selector := mload(0)

      switch and(selector, CONTRACT_MANAGEMENT_SELECTOR)
      case 0x8000000000000000000000000000000000000000000000000000000000000000 {
        // getters
        mstore(0x04, and(selector, not(CONTRACT_MANAGEMENT_SELECTOR)))
        mstore(0x08, DATA_FEED_LOCATION)
        mstore(0, sload(keccak256(0x04, 0x09)))
        return(0, 0x20)
      }
      default {
        // setters
        if eq(
          selector,
          // TODO check this magic selector -> estimatedGas: 25k
          // 0x4fa3895e -> estimatedGas: 47k
          // ??????????????
          0x3179a67f00000000000000000000000000000000000000000000000000000000
        ) {
          calldatacopy(4, 4, 0x04)
          mstore(0x08, DATA_FEED_LOCATION)

          calldatacopy(0x10, 8, 0x20)
          sstore(keccak256(0x04, 0x09), mload(0x10))
        }
      }
    }

    console.log('Gas used: %d', gasStart - gasleft());
  }
}
