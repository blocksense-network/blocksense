// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkFeedRegistry, IChainlinkAggregator} from './chainlink/IChainlinkFeedRegistry.sol';

interface ICLFeedRegistryAdapter is IChainlinkFeedRegistry {
  struct FeedData {
    IChainlinkAggregator aggregator;
    uint8 decimals;
    uint256 id;
    string description;
  }

  struct Feed {
    address base;
    address quote;
    address feed;
  }

  error OnlyOwner();

  /// @notice Contract owner
  /// @return owner The address of the owner
  function OWNER() external view returns (address);

  /// @notice Set the feed for a given pair
  /// @dev Stores immutable values (decimals, id, description) and contract address from CLAggregatorAdapter
  /// @param feeds Array of base, quote and feed address data
  function setFeeds(Feed[] calldata feeds) external;
}
