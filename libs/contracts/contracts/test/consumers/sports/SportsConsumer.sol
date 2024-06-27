// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '../../../libraries/SportsDecoder.sol';

contract SportsConsumer {
  address internal immutable dataFeedStore;

  constructor(address _dataFeedStore) {
    dataFeedStore = _dataFeedStore;
  }

  function decodeFootballData(
    uint32 key
  )
    external
    view
    returns (
      uint32,
      uint32,
      uint32,
      uint32,
      uint32,
      uint32,
      uint32,
      uint32,
      uint32,
      uint32
    )
  {
    return SportsDecoder.decodeFootballData(key, dataFeedStore);
  }
}
