// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SportsDecoder} from '../../libraries/SportsDecoder.sol';

contract SportsConsumer {
  address internal immutable dataFeedStore;

  event DataDecoded();

  constructor(address _dataFeedStore) {
    dataFeedStore = _dataFeedStore;
  }

  // 2 slots
  function decodeFootballData(
    uint32 key
  ) external returns (SportsDecoder.FootballData memory) {
    emit DataDecoded();
    return SportsDecoder.decodeFootballData(key, dataFeedStore);
  }

  // 3 slots
  function decodeBasketballData(
    uint32 key
  ) external returns (SportsDecoder.BasketballData memory) {
    emit DataDecoded();
    return SportsDecoder.decodeBasketballData(key, dataFeedStore);
  }
}
