// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SportsDecoder} from '../../libraries/SportsDecoder.sol';
import {SportsDataFeedStoreGenericV1} from '../../sports/SportsDataFeedStoreGenericV1.sol';
import {SportsGenericConsumer} from './SportsGenericConsumer.sol';

contract SportsGenericV1Consumer is SportsGenericConsumer {
  constructor(address _dataFeedStore) SportsGenericConsumer(_dataFeedStore) {}

  function decodeFootballData(
    uint32 key
  ) external returns (SportsDecoder.FootballData memory) {
    bytes32[] memory data = SportsDataFeedStoreGenericV1(dataFeedStore)
      .getDataFeed(key, 2);

    return _decodeFootballData(data);
  }

  function decodeBasketballData(
    uint32 key
  ) external returns (SportsDecoder.BasketballData memory) {
    bytes32[] memory data = SportsDataFeedStoreGenericV1(dataFeedStore)
      .getDataFeed(key, 3);

    return _decodeBasketballData(data);
  }
}
