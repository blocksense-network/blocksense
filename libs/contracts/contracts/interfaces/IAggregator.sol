// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from './chainlink/IChainlinkAggregator.sol';

interface IAggregator is IChainlinkAggregator {
  function key() external view returns (uint32);

  function dataFeedStore() external view returns (address);
}
