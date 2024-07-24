// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from './chainlink/IChainlinkAggregator.sol';

interface IAggregator is IChainlinkAggregator {
  /// @notice The feed data this contract is responsible for
  /// @dev This is the key ID for the mapping in the dataFeedStore
  /// @return key The key ID for the feed
  function key() external view returns (uint32);

  /// @notice The dataFeedStore this contract is responsible for
  /// @dev The address of the underlying contract that stores the data
  /// @return dataFeedStore The address of the dataFeedStore
  function dataFeedStore() external view returns (address);
}
