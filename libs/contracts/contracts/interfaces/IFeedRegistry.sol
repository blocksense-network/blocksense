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

  function OWNER() external view returns (address);
}
