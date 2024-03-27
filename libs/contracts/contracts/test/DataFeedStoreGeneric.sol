// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IDataFeedStoreGeneric} from './IDataFeedStoreGeneric.sol';

contract DataFeedStoreGeneric is IDataFeedStoreGeneric {
  mapping(uint256 => bytes32) public dataFeeds;
  address public immutable owner;

  constructor() {
    owner = msg.sender;
  }

  function setFeeds(
    uint256[] calldata keys,
    bytes32[] calldata values
  ) external {
    if (msg.sender != owner) {
      revert NotAuthorized();
    }
    if (keys.length != values.length) {
      revert WrongInputLength();
    }

    for (uint i = 0; i < keys.length; ) {
      dataFeeds[keys[i]] = values[i];
      unchecked {
        ++i;
      }
    }
  }

  function getDataFeed(uint256 key) external view returns (bytes32) {
    return dataFeeds[key];
  }
}
