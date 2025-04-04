// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '../../interfaces/ICLFeedRegistryAdapter.sol';

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract CLFeedRegistryAdapterConsumer {
  ICLFeedRegistryAdapter public immutable registry;

  constructor(address _registry) {
    registry = ICLFeedRegistryAdapter(_registry);
  }

  function getDecimals(
    address base,
    address quote
  ) external view returns (uint8 decimals) {
    return registry.decimals(base, quote);
  }

  function getDescription(
    address base,
    address quote
  ) external view returns (string memory description) {
    return registry.description(base, quote);
  }

  function getLatestAnswer(
    address base,
    address quote
  ) external view returns (uint256 asnwer) {
    return uint256(registry.latestAnswer(base, quote));
  }

  function getLatestRound(
    address base,
    address quote
  ) external view returns (uint256 roundId) {
    return registry.latestRound(base, quote);
  }

  function getRoundData(
    address base,
    address quote,
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
    return registry.getRoundData(base, quote, roundId);
  }

  function getLatestRoundData(
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
    )
  {
    return registry.latestRoundData(base, quote);
  }

  function getFeed(
    address base,
    address quote
  ) external view returns (IChainlinkAggregator feed) {
    return registry.getFeed(base, quote);
  }
}
