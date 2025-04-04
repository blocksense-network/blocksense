/**
 * SPDX-FileCopyrightText: Copyright (c) 2021 SmartContract ChainLink Limited SEZC
 *
 * SPDX-License-Identifier: MIT
 */
pragma solidity ^0.8.28;

import {IChainlinkAggregator} from './IChainlinkAggregator.sol';

interface IChainlinkFeedRegistry {
  /// @notice Get decimals for a feed pair
  /// @param base The base asset of the feed
  /// @param quote The quote asset of the feed
  /// @return decimals The decimals of the feed pair
  function decimals(address base, address quote) external view returns (uint8);

  /// @notice Get description for a feed pair
  /// @param base The base asset of the feed
  /// @param quote The quote asset of the feed
  /// @return description The description of the feed pair
  function description(
    address base,
    address quote
  ) external view returns (string memory);

  /// @notice Get the latest answer for a feed pair
  /// @param base The base asset of the feed
  /// @param quote The quote asset of the feed
  /// @return answer The value sotred for the feed pair
  function latestAnswer(
    address base,
    address quote
  ) external view returns (int256 answer);

  /// @notice Get the latest round ID for a feed pair
  /// @param base The base asset of the feed
  /// @param quote The quote asset of the feed
  /// @return roundId The latest round ID
  function latestRound(
    address base,
    address quote
  ) external view returns (uint256 roundId);

  /// @notice Get the round data for a feed pair at a given round ID
  /// @param base The base asset of the feed
  /// @param quote The quote asset of the feed
  /// @param _roundId The round ID to retrieve data for
  /// @return roundId The round ID
  /// @return answer The value stored for the feed at the given round ID
  /// @return startedAt The timestamp when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
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

  /// @notice Get the latest round data for a feed pair
  /// @param base The base asset of the feed
  /// @param quote The quote asset of the feed
  /// @return roundId The latest round ID stored for the feed pair
  /// @return answer The latest value stored for the feed pair
  /// @return startedAt The timestamp when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
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

  /// @notice Get the CLAggregatorAdapter contract for a feed pair
  /// @param base The base asset of the feed
  /// @param quote The quote asset of the feed
  /// @return aggregator The CLAggregatorAdapter contract given pair
  function getFeed(
    address base,
    address quote
  ) external view returns (IChainlinkAggregator aggregator);
}
