// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from '../../interfaces/IChainlinkAggregator.sol';
import {IAggregator} from '../../interfaces/IAggregator.sol';
import {IFeedRegistry} from '../../interfaces/IFeedRegistry.sol';
import {ProxyCall} from '../../libraries/ProxyCall.sol';

contract FeedRegistry is IFeedRegistry {
  struct Feed {
    address dataFeedStore;
    uint32 key;
  }

  address public immutable owner;
  mapping(address => mapping(address => IChainlinkAggregator))
    internal registry;
  mapping(address => mapping(address => Feed)) internal dataFeedStore;

  error OnlyOwner();

  constructor(address _owner) {
    owner = _owner;
  }

  function decimals(
    address base,
    address quote
  ) external view override returns (uint8) {
    return registry[base][quote].decimals();
  }

  function description(
    address base,
    address quote
  ) external view override returns (string memory) {
    return registry[base][quote].description();
  }

  function latestAnswer(
    address base,
    address quote
  ) external view override returns (int256) {
    Feed memory feed = dataFeedStore[base][quote];
    return ProxyCall._latestAnswer(feed.key, feed.dataFeedStore);
  }

  function getRoundData(
    address base,
    address quote,
    uint80 _roundId
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    Feed memory feed = dataFeedStore[base][quote];
    return ProxyCall._getRoundData(_roundId, feed.key, feed.dataFeedStore);
  }

  function getFeed(
    address base,
    address quote
  ) external view override returns (IChainlinkAggregator) {
    return registry[base][quote];
  }

  function setFeed(address base, address quote, address feed) external {
    if (msg.sender != owner) {
      revert OnlyOwner();
    }

    registry[base][quote] = IChainlinkAggregator(feed);
    dataFeedStore[base][quote] = Feed(
      IAggregator(feed).dataFeedStore(),
      IAggregator(feed).key()
    );
  }

  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256) {
    Feed memory feed = dataFeedStore[base][quote];
    return ProxyCall._latestRound(feed.key, feed.dataFeedStore);
  }

  function latestRoundData(
    address base,
    address quote
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    Feed memory feed = dataFeedStore[base][quote];
    return ProxyCall._latestRoundData(feed.key, feed.dataFeedStore);
  }
}
