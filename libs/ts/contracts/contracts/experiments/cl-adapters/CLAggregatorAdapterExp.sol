// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '../interfaces/ICLAggregatorAdapterExp.sol';
import {BlocksenseExp} from '../libraries/BlocksenseExp.sol';

/// @title CLAggregatorAdapterExp
/// @notice This contract is part of the experiment contracts
/// Contract that proxies calls to the dataFeedStore
/// This contract is responsible for fetching data for one feed only
contract CLAggregatorAdapterExp is ICLAggregatorAdapterExp {
  /// @inheritdoc IChainlinkAggregator
  uint8 public immutable override decimals;
  /// @inheritdoc ICLAggregatorAdapterExp
  uint32 public immutable override key;
  /// @inheritdoc ICLAggregatorAdapterExp
  address public immutable override dataFeedStore;

  /// @inheritdoc IChainlinkAggregator
  string public override description;

  /// @notice Constructor
  /// @param _description The description of the feed
  /// @param _decimals The decimals of the feed
  /// @param _key The key ID of the feed
  /// @param _dataFeedStore The address of the data feed store
  constructor(
    string memory _description,
    uint8 _decimals,
    uint32 _key,
    address _dataFeedStore
  ) {
    description = _description;
    decimals = _decimals;
    key = _key;
    dataFeedStore = _dataFeedStore;
  }

  /// @inheritdoc IChainlinkAggregator
  function latestAnswer() external view override returns (int256) {
    return BlocksenseExp._latestAnswer(key, dataFeedStore);
  }

  /// @inheritdoc IChainlinkAggregator
  function latestRound() external view override returns (uint256) {
    return BlocksenseExp._latestRound(key, dataFeedStore);
  }

  /// @inheritdoc IChainlinkAggregator
  function latestRoundData()
    external
    view
    override
    returns (uint80, int256, uint256, uint256, uint80)
  {
    return BlocksenseExp._latestRoundData(key, dataFeedStore);
  }

  /// @inheritdoc IChainlinkAggregator
  function getRoundData(
    uint80 _roundId
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return BlocksenseExp._getRoundData(_roundId, key, dataFeedStore);
  }
}
