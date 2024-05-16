// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from './IChainlinkAggregator.sol';

interface IFeedRegistry {
  function decimals(address base, address quote) external view returns (uint8);

  function description(
    address base,
    address quote
  ) external view returns (string memory);

  function latestAnswer(
    address base,
    address quote
  ) external view returns (int256 answer);

  function latestRound(
    address base,
    address quote
  ) external view returns (uint256 roundId);

  function getRoundData(
    address base,
    address quote,
    uint80 _roundId
  )
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

  function latestRoundData(
    address base,
    address quote
  )
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

  function getFeed(
    address base,
    address quote
  ) external view returns (IChainlinkAggregator aggregator);
}
