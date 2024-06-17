// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from '../../interfaces/chainlink/IChainlinkAggregator.sol';
import {IAggregator} from '../../interfaces/IAggregator.sol';
import {IFeedRegistry} from '../../interfaces/IFeedRegistry.sol';
import {ProxyCall} from '../../libraries/ProxyCall.sol';

contract FeedRegistry is IFeedRegistry {
  address internal immutable DATA_FEED_STORE;
  address public immutable override OWNER;

  mapping(address => mapping(address => Feed)) internal feedData;

  constructor(address _owner, address _dataFeedStore) {
    OWNER = _owner;
    DATA_FEED_STORE = _dataFeedStore;
  }

  function decimals(
    address base,
    address quote
  ) external view override returns (uint8) {
    return feedData[base][quote].decimals;
  }

  function description(
    address base,
    address quote
  ) external view override returns (string memory) {
    return feedData[base][quote].description;
  }

  function latestAnswer(
    address base,
    address quote
  ) external view override returns (int256) {
    return ProxyCall._latestAnswer(feedData[base][quote].key, DATA_FEED_STORE);
  }

  function getRoundData(
    address base,
    address quote,
    uint80 _roundId
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return
      ProxyCall._getRoundData(
        _roundId,
        feedData[base][quote].key,
        DATA_FEED_STORE
      );
  }

  function getFeed(
    address base,
    address quote
  ) external view override returns (IChainlinkAggregator) {
    return feedData[base][quote].aggregator;
  }

  function setFeed(address base, address quote, address feed) external {
    if (msg.sender != OWNER) {
      revert OnlyOwner();
    }

    feedData[base][quote] = Feed(
      IChainlinkAggregator(feed),
      IAggregator(feed).key(),
      IAggregator(feed).decimals(),
      IAggregator(feed).description()
    );
  }

  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256) {
    return ProxyCall._latestRound(feedData[base][quote].key, DATA_FEED_STORE);
  }

  function latestRoundData(
    address base,
    address quote
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return
      ProxyCall._latestRoundData(feedData[base][quote].key, DATA_FEED_STORE);
  }
}
