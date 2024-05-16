// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {FeedRegistry} from './FeedRegistry.sol';
import {ProxyCallV2} from '../../libraries/ProxyCallV2.sol';

contract FeedRegistryV2 is FeedRegistry {
  constructor(address _owner) FeedRegistry(_owner) {}

  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256) {
    Feed memory feed = dataFeedStore[base][quote];
    return ProxyCallV2._latestRound(feed.key, feed.dataFeedStore);
  }

  function latestRoundData(
    address base,
    address quote
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    Feed memory feed = dataFeedStore[base][quote];
    return ProxyCallV2._latestRoundData(feed.key, feed.dataFeedStore);
  }
}
