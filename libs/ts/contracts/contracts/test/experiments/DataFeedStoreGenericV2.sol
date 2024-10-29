// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DataFeedStoreGeneric} from './DataFeedStoreGeneric.sol';
import {IDataFeedStoreGenericV2} from './interfaces/IDataFeedStoreGenericV2.sol';

contract DataFeedStoreGenericV2 is
  DataFeedStoreGeneric,
  IDataFeedStoreGenericV2
{
  function setFeeds(bytes calldata data) external onlyOwner {
    if (data.length % 36 != 0) {
      revert WrongInputLength();
    }

    for (uint i = 0; i < data.length; ) {
      dataFeeds[uint32(bytes4(data[i:i + 4]))] = bytes32(data[i + 4:i + 36]);
      unchecked {
        i += 36;
      }
    }
  }

  function getDataFeed(uint32 key) external view returns (bytes32) {
    return dataFeeds[key];
  }
}
