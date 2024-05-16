// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ProxyCallV1} from '../../libraries/ProxyCallV1.sol';
import {FeedRegistry} from './FeedRegistry.sol';

contract FeedRegistryV1 is FeedRegistry {
  constructor(address _owner) FeedRegistry(_owner) {}

  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256) {
    Feed memory feed = dataFeedStore[base][quote];
    return ProxyCallV1._latestRound(feed.key, feed.dataFeedStore);
  }

  function latestRoundData(
    address base,
    address quote
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    Feed memory feed = dataFeedStore[base][quote];
    return ProxyCallV1._latestRoundData(feed.key, feed.dataFeedStore);
  }
}
