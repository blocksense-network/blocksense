// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ICLFeedRegistryAdapter} from '../../interfaces/ICLFeedRegistryAdapter.sol';
import {IChainlinkAggregator} from '../../interfaces/chainlink/IChainlinkAggregator.sol';

contract Registry {
  ICLFeedRegistryAdapter public immutable registry;

  string public description;
  uint256 public price;
  uint256 public lastUpdate;
  IChainlinkAggregator public feed;
  uint80 public roundId;
  uint8 public decimals;

  constructor(address _registry) {
    registry = ICLFeedRegistryAdapter(_registry);
  }

  function setDecimals(address base, address quote) external {
    decimals = registry.decimals(base, quote);
  }

  function setDescription(address base, address quote) external {
    description = registry.description(base, quote);
  }

  function setLatestAnswer(address base, address quote) external {
    price = uint256(registry.latestAnswer(base, quote));
  }

  function setLatestRoundId(address base, address quote) external {
    roundId = uint80(registry.latestRound(base, quote));
  }

  function setLatestRoundData(address base, address quote) external {
    (uint80 _roundId, int256 _price, uint256 _lastUpdate, , ) = registry
      .latestRoundData(base, quote);
    price = uint256(_price);
    lastUpdate = _lastUpdate;
    roundId = _roundId;
  }

  function setRoundData(address base, address quote, uint80 _roundId) external {
    (, int256 _price, uint256 _lastUpdate, , ) = registry.getRoundData(
      base,
      quote,
      _roundId
    );
    price = uint256(_price);
    lastUpdate = _lastUpdate;
    roundId = _roundId;
  }

  function setFeed(address base, address quote) external {
    feed = registry.getFeed(base, quote);
  }
}
