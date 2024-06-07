// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from '../../interfaces/IChainlinkAggregator.sol';
import {IAggregator} from '../../interfaces/IAggregator.sol';
import {IFeedRegistry} from '../../interfaces/IFeedRegistry.sol';
import {ProxyCall} from '../../libraries/ProxyCall.sol';

contract FeedRegistry is IFeedRegistry {
  struct Feed {
    IChainlinkAggregator aggregator;
    uint32 key;
    uint8 decimals;
    string description;
  }

  address internal immutable dataFeedStore;

  address public immutable owner;

  mapping(address => mapping(address => Feed)) internal feedData;

  error OnlyOwner();

  constructor(address _owner, address _dataFeedStore) {
    owner = _owner;
    dataFeedStore = _dataFeedStore;
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
    return ProxyCall._latestAnswer(feedData[base][quote].key, dataFeedStore);
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
        dataFeedStore
      );
  }

  function getFeed(
    address base,
    address quote
  ) external view override returns (IChainlinkAggregator) {
    return feedData[base][quote].aggregator;
  }

  function setFeed(address base, address quote, address feed) external {
    if (msg.sender != owner) {
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
    return ProxyCall._latestRound(feedData[base][quote].key, dataFeedStore);
  }

  function latestRoundData(
    address base,
    address quote
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return ProxyCall._latestRoundData(feedData[base][quote].key, dataFeedStore);
  }
}
