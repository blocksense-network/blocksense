// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IChainlinkAggregator {
  function decimals() external view returns (uint8);

  function description() external view returns (string memory);

  function latestAnswer() external view returns (int256);

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
