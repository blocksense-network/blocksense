// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '../../interfaces/ICLFeedRegistryAdapterExp.sol';
import {ICLAggregatorAdapterExp} from '../../interfaces/ICLAggregatorAdapterExp.sol';
import {BlocksenseExp} from '../../libraries/BlocksenseExp.sol';

/// @title CLFeedRegistryAdapterExp
/// @notice This contract is part of the experiment contracts
/// Registry aggregating information from CLAggregatorAdapters and the feed itself
/// This contract is used to store and retrieve information about feeds
/// @dev To reduce gas costs, the contract calls the dataFeedStore directly instead of using the CLAggregatorAdapter
contract CLFeedRegistryAdapterExp is ICLFeedRegistryAdapterExp {
  /// @notice The data feed store contract
  address internal immutable DATA_FEED_STORE;
  /// @inheritdoc ICLFeedRegistryAdapterExp
  address public immutable override OWNER;

  /// @notice Feed data for a given pair
  mapping(address => mapping(address => FeedData)) internal feedData;

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
    return
      BlocksenseExp._latestAnswer(feedData[base][quote].key, DATA_FEED_STORE);
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function getRoundData(
    address base,
    address quote,
    uint80 _roundId
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return
      BlocksenseExp._getRoundData(
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

  /// @inheritdoc ICLFeedRegistryAdapterExp
  function setFeeds(Feed[] calldata feeds) external override {
    if (msg.sender != OWNER) {
      revert OnlyOwner();
    }

    for (uint256 i = 0; i < feeds.length; i++) {
      feedData[feeds[i].base][feeds[i].quote] = FeedData(
        IChainlinkAggregator(feeds[i].feed),
        ICLAggregatorAdapterExp(feeds[i].feed).key(),
        ICLAggregatorAdapterExp(feeds[i].feed).decimals(),
        ICLAggregatorAdapterExp(feeds[i].feed).description()
      );
    }
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256) {
    return
      BlocksenseExp._latestRound(feedData[base][quote].key, DATA_FEED_STORE);
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function latestRoundData(
    address base,
    address quote
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return
      BlocksenseExp._latestRoundData(
        feedData[base][quote].key,
        DATA_FEED_STORE
      );
  }
}
