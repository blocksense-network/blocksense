// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from '../../interfaces/chainlink/IChainlinkAggregator.sol';

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract CLAggregatorAdapterConsumer {
  IChainlinkAggregator public immutable feed;

  constructor(address feedAddress) {
    feed = IChainlinkAggregator(feedAddress);
  }

  function getDecimals() external view returns (uint8 decimals_) {
    return feed.decimals();
  }

  function getDescription() external view returns (string memory description_) {
    return feed.description();
  }

  function getLatestAnswer() external view returns (uint256 answer) {
    return uint256(feed.latestAnswer());
  }

  function getLatestRound() external view returns (uint256 roundId) {
    return feed.latestRound();
  }

  function getRoundData(
    uint80 roundId
  )
    external
    view
    returns (
      uint80 roundId_,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    return feed.getRoundData(roundId);
  }

  function getLatestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    return feed.latestRoundData();
  }
}
