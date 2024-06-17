// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '../../interfaces/IFeedRegistry.sol';
import {IChainlinkAggregator} from '../../interfaces/chainlink/IChainlinkAggregator.sol';
import {IAggregator} from '../../interfaces/IAggregator.sol';
import {ProxyCall} from '../../libraries/ProxyCall.sol';

/// @title Registry aggregating information from ChainlinkProxies and the feed itself
/// @notice This contract is used to store and retrieve information about feeds
/// @dev To reduce gas costs, the contract calls the dataFeedStore directly instead of using the ChainlinkProxy
contract FeedRegistry is IFeedRegistry {
  /// @notice The data feed store contract
  address internal immutable DATA_FEED_STORE;
  /// @inheritdoc IFeedRegistry
  address public immutable override OWNER;

  /// @notice Feed data for a given pair
  mapping(address => mapping(address => Feed)) internal feedData;

  /// @notice Constructor
  /// @param _owner The owner of the contract
  /// @param _dataFeedStore The address of the data feed store
  constructor(address _owner, address _dataFeedStore) {
    OWNER = _owner;
    DATA_FEED_STORE = _dataFeedStore;
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function decimals(
    address base,
    address quote
  ) external view override returns (uint8) {
    return feedData[base][quote].decimals;
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function description(
    address base,
    address quote
  ) external view override returns (string memory) {
    return feedData[base][quote].description;
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function latestAnswer(
    address base,
    address quote
  ) external view override returns (int256) {
    return ProxyCall._latestAnswer(feedData[base][quote].key, DATA_FEED_STORE);
  }

  /// @inheritdoc IChainlinkFeedRegistry
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

  /// @inheritdoc IChainlinkFeedRegistry
  function getFeed(
    address base,
    address quote
  ) external view override returns (IChainlinkAggregator) {
    return feedData[base][quote].aggregator;
  }

  /// @inheritdoc IFeedRegistry
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

  /// @inheritdoc IChainlinkFeedRegistry
  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256) {
    return ProxyCall._latestRound(feedData[base][quote].key, DATA_FEED_STORE);
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function latestRoundData(
    address base,
    address quote
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return
      ProxyCall._latestRoundData(feedData[base][quote].key, DATA_FEED_STORE);
  }
}
