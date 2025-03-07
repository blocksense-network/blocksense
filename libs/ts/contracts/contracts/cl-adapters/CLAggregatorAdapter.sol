// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '../interfaces/ICLAggregatorAdapter.sol';
import {CLAdapterLib} from '../libraries/CLAdapterLib.sol';

/// @title CLAggregatorAdapter
/// @notice Contract that proxies calls to the dataFeedStore
/// @notice This contract is responsible for fetching data for one feed only
contract CLAggregatorAdapter is ICLAggregatorAdapter {
  /// @inheritdoc IChainlinkAggregator
  uint8 public immutable override decimals;
  /// @inheritdoc ICLAggregatorAdapter
  uint256 public immutable override id;
  /// @inheritdoc ICLAggregatorAdapter
  address public immutable override dataFeedStore;

  /// @inheritdoc IChainlinkAggregator
  string public override description;

  /// @notice Constructor
  /// @param _description The description of the feed
  /// @param _decimals The decimals of the feed
  /// @param _id The ID of the feed
  /// @param _dataFeedStore The address of the data feed store
  constructor(
    string memory _description,
    uint8 _decimals,
    uint256 _id,
    address _dataFeedStore
  ) {
    description = _description;
    decimals = _decimals;
    id = CLAdapterLib._shiftId(_id);
    dataFeedStore = _dataFeedStore;
  }

  /// @inheritdoc IChainlinkAggregator
  function latestAnswer() external view override returns (int256) {
    return CLAdapterLib._latestAnswer(id, dataFeedStore);
  }

  /// @inheritdoc IChainlinkAggregator
  function latestRound() external view override returns (uint256) {
    return CLAdapterLib._latestRound(id, dataFeedStore);
  }

  /// @inheritdoc IChainlinkAggregator
  function latestRoundData()
    external
    view
    override
    returns (uint80, int256, uint256, uint256, uint80)
  {
    return CLAdapterLib._latestRoundData(id, dataFeedStore);
  }

  /// @inheritdoc IChainlinkAggregator
  function getRoundData(
    uint80 _roundId
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return CLAdapterLib._getRoundData(_roundId, id, dataFeedStore);
  }
}
