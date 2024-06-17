// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAggregator} from '../interfaces/IAggregator.sol';
import {ProxyCall} from '../libraries/ProxyCall.sol';

contract ChainlinkProxy is IAggregator {
  uint8 public immutable override decimals;
  uint32 public immutable override key;
  address public immutable override dataFeedStore;

  string public override description;

  constructor(
    string memory _description,
    uint8 _decimals,
    uint32 _key,
    address _dataFeedStore
  ) {
    description = _description;
    decimals = _decimals;
    key = _key;
    dataFeedStore = _dataFeedStore;
  }

  function latestAnswer() external view override returns (int256) {
    return ProxyCall._latestAnswer(key, dataFeedStore);
  }

  function latestRound() external view override returns (uint256) {
    return ProxyCall._latestRound(key, dataFeedStore);
  }

  function latestRoundData()
    external
    view
    override
    returns (uint80, int256, uint256, uint256, uint80)
  {
    return ProxyCall._latestRoundData(key, dataFeedStore);
  }

  function getRoundData(
    uint80 _roundId
  ) external view override returns (uint80, int256, uint256, uint256, uint80) {
    return ProxyCall._getRoundData(_roundId, key, dataFeedStore);
  }
}
