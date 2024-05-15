// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IChainlinkAggregator {
  function key() external view returns (uint32);

  function dataFeedStore() external view returns (address);

  function decimals() external view returns (uint8);

  function description() external view returns (string memory);

  function latestAnswer() external view returns (int256);

  function latestRound() external view returns (uint256);

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
