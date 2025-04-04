// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IChainlinkAggregator} from './chainlink/IChainlinkAggregator.sol';

interface ICLAggregatorAdapter is IChainlinkAggregator {
  /// @notice The feed data this contract is responsible for
  /// @dev This is the feed ID for the mapping in the dataFeedStore
  /// @return _id The ID for the feed
  function id() external view returns (uint256);

  /// @notice The dataFeedStore this contract is responsible for
  /// @dev The address of the underlying contract that stores the data
  /// @return dataFeedStore The address of the dataFeedStore
  function dataFeedStore() external view returns (address);
}
