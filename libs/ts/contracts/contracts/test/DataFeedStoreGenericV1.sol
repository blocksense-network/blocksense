// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DataFeedStoreGeneric} from './DataFeedStoreGeneric.sol';
import {IDataFeedStoreGenericV1} from './interfaces/IDataFeedStoreGenericV1.sol';

contract DataFeedStoreGenericV1 is
  DataFeedStoreGeneric,
  IDataFeedStoreGenericV1
{
  function setFeeds(
    uint256[] calldata keys,
    bytes32[] calldata values
  ) external onlyOwner {
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
