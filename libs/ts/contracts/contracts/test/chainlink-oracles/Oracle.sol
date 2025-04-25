// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from '../../interfaces/chainlink/IChainlinkAggregator.sol';

contract Oracle {
  string public description;
  uint256 public price;
  uint256 public lastUpdate;
  uint80 public roundId;
  uint8 public decimals;
  IChainlinkAggregator public immutable dataFeedStore;

  constructor(address _dataFeedStore) {
    dataFeedStore = IChainlinkAggregator(_dataFeedStore);
  }

  function setDecimals() external {
    decimals = dataFeedStore.decimals();
  }

  function setDescription() external {
    description = dataFeedStore.description();
  }

  function setLatestAnswer() external {
    price = uint256(dataFeedStore.latestAnswer());
  }

  function setLatestRoundId() external {
    roundId = uint80(dataFeedStore.latestRound());
  }

  function setLatestRoundData() external {
    (uint80 _roundId, int256 _price, uint256 _lastUpdate, , ) = dataFeedStore
      .latestRoundData();
    price = uint256(_price);
    lastUpdate = _lastUpdate;
    roundId = _roundId;
  }

  function setRoundData(uint80 _roundId) external {
    (, int256 _price, uint256 _lastUpdate, , ) = dataFeedStore.getRoundData(
      _roundId
    );
    price = uint256(_price);
    lastUpdate = _lastUpdate;
    roundId = _roundId;
  }
}
