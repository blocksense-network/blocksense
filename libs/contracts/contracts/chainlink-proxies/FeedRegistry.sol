// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from '../interfaces/IChainlinkAggregator.sol';
import {IFeedRegistry} from '../interfaces/IChainlinkFeedRegistry.sol';

contract FeedRegistry is IFeedRegistry {
  address public immutable owner;
  mapping(address => mapping(address => IChainlinkAggregator))
    internal registry;

  error OnlyOwner();

  constructor(address _owner) {
    owner = _owner;
  }

  function latestAnswer(
    address base,
    address quote
  ) external view override returns (int256) {
    return registry[base][quote].latestAnswer();
  }

  function decimals(
    address base,
    address quote
  ) external view override returns (uint8) {
    return registry[base][quote].decimals();
  }

  function latestRoundData(
    address base,
    address quote
  )
    external
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    return registry[base][quote].latestRoundData();
  }

  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256) {
    return registry[base][quote].latestRound();
  }

  function getRoundData(
    address base,
    address quote,
    uint80 _roundId
  )
    external
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    return registry[base][quote].getRoundData(_roundId);
  }

  function description(
    address base,
    address quote
  ) external view override returns (string memory) {
    return registry[base][quote].description();
  }

  function getFeed(
    address base,
    address quote
  ) external view override returns (IChainlinkAggregator) {
    return registry[base][quote];
  }

  function setFeed(address base, address quote, address feed) external {
    if (msg.sender != owner) {
      revert OnlyOwner();
    }
    registry[base][quote] = IChainlinkAggregator(feed);
  }
}
