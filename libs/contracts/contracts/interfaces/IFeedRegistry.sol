// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkFeedRegistry, IChainlinkAggregator} from './chainlink/IChainlinkFeedRegistry.sol';

interface IFeedRegistry is IChainlinkFeedRegistry {
  struct Feed {
    IChainlinkAggregator aggregator;
    uint32 key;
    uint8 decimals;
    string description;
  }

  error OnlyOwner();

  /// @notice Contract owner
  /// @return owner The address of the owner
  function OWNER() external view returns (address);

  /// @notice Set the feed for a given pair
  /// @dev Stores immutable values (decimals, key, description) and contract address from ChainlinkProxy
  /// @param base The base asset of the feed
  /// @param quote The quote asset of the feed
  /// @param feed The address of the ChainlinkProxy contract
  function setFeed(address base, address quote, address feed) external;
}
