// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
import 'hardhat/console.sol';

contract DataFeedStoreV1 {
  uint8 public constant DATA_FEED_LOCATION = 0x00;
  bytes4 public constant CONTRACT_MANAGEMENT_SELECTOR = 0x000000ff;

  // Fallback function to store dataFeeds
  fallback(bytes calldata data) external returns (bytes memory) {
    uint gasStart = gasleft();
    bytes4 selector = bytes4(data[:4]);

    if (selector < CONTRACT_MANAGEMENT_SELECTOR) {
      bytes32 locationInStorage;
      assembly {
        calldatacopy(0, 0, 0x04)
        mstore(0x04, DATA_FEED_LOCATION)
        mstore(0, sload(keccak256(0, 0x05)))
        return(0, 0x20)
      }
    } else {
      (uint32 key, bytes32 value) = abi.decode(data[4:], (uint32, bytes32));
      if (selector == 0x4fa3895e) {
        setFeedById(key, value);
      }
    }
    console.log('Gas used: %d', gasStart - gasleft());
  }

  // selector: 0x4fa3895e
  function setFeedById(uint32 _key, bytes32 _value) internal {
    bytes32 locationInStorage = keccak256(
      abi.encodePacked(_key, DATA_FEED_LOCATION)
    );
    assembly {
      sstore(locationInStorage, _value)
    }
  }
}
