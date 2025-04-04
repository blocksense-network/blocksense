// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Copyright (c) 2024-2025 Schelling Point Labs Inc.
pragma solidity ^0.8.28;

import '../../interfaces/ICLFeedRegistryAdapter.sol';
import {ICLAggregatorAdapter} from '../../interfaces/ICLAggregatorAdapter.sol';
import {CLAdapterLib} from '../../libraries/CLAdapterLib.sol';

/// @title Registry aggregating information from CLAggregatorAdapters and the feed itself
/// @author Aneta Tsvetkova
/// @notice This contract is used to store and retrieve information about feeds
/// @dev To reduce gas costs, the contract calls the dataFeedStore directly instead of using the CLAggregatorAdapter
contract CLFeedRegistryAdapter is ICLFeedRegistryAdapter {
  /// @notice The data feed store contract
  address internal immutable DATA_FEED_STORE;
  /// @inheritdoc ICLFeedRegistryAdapter
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
      CLAdapterLib._latestAnswer(feedData[base][quote].id, DATA_FEED_STORE);
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function getRoundData(
    address base,
    address quote,
    uint80 _roundId
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return
      CLAdapterLib._getRoundData(
        _roundId,
        feedData[base][quote].id,
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

  /// @inheritdoc ICLFeedRegistryAdapter
  function setFeeds(Feed[] calldata feeds) external override {
    if (msg.sender != OWNER) {
      revert OnlyOwner();
    }

    for (uint256 i = 0; i < feeds.length; i++) {
      feedData[feeds[i].base][feeds[i].quote] = FeedData(
        IChainlinkAggregator(feeds[i].feed),
        ICLAggregatorAdapter(feeds[i].feed).decimals(),
        CLAdapterLib._shiftId(ICLAggregatorAdapter(feeds[i].feed).id()),
        ICLAggregatorAdapter(feeds[i].feed).description()
      );
    }
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256) {
    return CLAdapterLib._latestRound(feedData[base][quote].id, DATA_FEED_STORE);
  }

  /// @inheritdoc IChainlinkFeedRegistry
  function latestRoundData(
    address base,
    address quote
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return
      CLAdapterLib._latestRoundData(feedData[base][quote].id, DATA_FEED_STORE);
  }
}
