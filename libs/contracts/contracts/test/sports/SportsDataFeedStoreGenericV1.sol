// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DataFeedStoreGeneric} from '../DataFeedStoreGeneric.sol';

contract SportsDataFeedStoreGenericV1 is DataFeedStoreGeneric {
  event DataFeedSet(uint32 key, bytes32 description);

  function setFeeds(
    uint256[] calldata keys,
    bytes32[][] calldata values,
    bytes32[] calldata descriptions
  ) external onlyOwner {
    uint256 keysLength = keys.length;
    if (keysLength != values.length) {
      revert WrongInputLength();
    }

    for (uint i = 0; i < keysLength; ) {
      uint256 key = keys[i];
      uint256 valuesLength = values[i].length;
      for (uint j = 0; j < valuesLength; ) {
        dataFeeds[key + j] = values[i][j];
        unchecked {
          ++j;
        }
      }

      emit DataFeedSet(uint32(key), descriptions[i]);

      unchecked {
        ++i;
      }
    }
  }

  function getDataFeed(
    uint256 key,
    uint256 length
  ) external view returns (bytes32[] memory result) {
    result = new bytes32[](length);
    for (uint i = 0; i < length; ) {
      result[i] = dataFeeds[key];
      unchecked {
        ++i;
        ++key;
      }
    }
  }
}
