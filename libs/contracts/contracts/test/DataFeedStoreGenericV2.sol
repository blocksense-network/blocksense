// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IDataFeedStoreGenericV2} from './IDataFeedStoreGenericV2.sol';

contract DataFeedStoreGenericV2 is IDataFeedStoreGenericV2 {
  mapping(uint32 => bytes32) public dataFeeds;
  address public immutable owner;

  constructor() {
    owner = msg.sender;
  }

  function setFeeds(bytes calldata data) external {
    if (msg.sender != owner) {
      revert NotAuthorized();
    }

    if (data.length % 36 != 0) {
      revert WrongInputLength();
    }

    for (uint i = 0; i < data.length; ) {
      dataFeeds[uint32(bytes4(data[i:i + 4]))] = bytes32(data[i + 4:i + 36]);
      unchecked {
        i = i + 36;
      }
    }
  }

  function getDataFeed(uint32 key) external view returns (bytes32) {
    return dataFeeds[key];
  }
}
