/**
 * SPDX-FileCopyrightText: Copyright (c) 2021 SmartContract ChainLink Limited SEZC
 *
 * SPDX-License-Identifier: MIT
 */
pragma solidity ^0.8.24;

interface IChainlinkAggregator {
  /// @notice Decimals for the feed data
  /// @return decimals The decimals of the feed
  function decimals() external view returns (uint8);

  /// @notice Description text for the feed data
  /// @return description The description of the feed
  function description() external view returns (string memory);

  /// @notice Get the latest answer for the feed
  /// @return answer The latest value stored
  function latestAnswer() external view returns (int256);

  /// @notice Get the latest round ID for the feed
  /// @return roundId The latest round ID
  function latestRound() external view returns (uint256);

  /// @notice Get the data for a round at a given round ID
  /// @param _roundId The round ID to retrieve the data for
  /// @return roundId The round ID
  /// @return answer The value stored for the round
  /// @return startedAt Timestamp of when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
  function getRoundData(
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

  /// @notice Get the latest round data available
  /// @return roundId The latest round ID for the feed
  /// @return answer The value stored for the round
  /// @return startedAt Timestamp of when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );
}
