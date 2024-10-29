// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHistoricalDataFeed} from './interfaces/IHistoricalDataFeed.sol';

contract HistoricalDataFeedStoreGenericV1 is IHistoricalDataFeed {
  uint16 internal constant MAX_COUNTER = 0xFFFF;

  mapping(uint256 => mapping(uint256 => Transmission))
    internal historicalDataFeeds;
  mapping(uint256 => uint256) internal counters;
  address internal immutable owner;

  error NotAuthorized();
  error WrongInputLength();

  constructor() {
    owner = msg.sender;
  }

  modifier onlyOwner() {
    if (msg.sender != owner) {
      revert NotAuthorized();
    }
    _;
  }

  function setFeeds(
    uint256[] calldata keys,
    bytes32[] calldata values
  ) external onlyOwner {
    if (keys.length != values.length) {
      revert WrongInputLength();
    }

    for (uint i = 0; i < keys.length; ) {
      uint256 counter = counters[keys[i]];
      counter = (counter + 1) % MAX_COUNTER;
      if (counter == 0) {
        counter = 1;
      }
      historicalDataFeeds[keys[i]][counter] = Transmission({
        value: bytes24(values[i]),
        timestamp: uint64(block.timestamp)
      });
      counters[keys[i]] = counter;
      unchecked {
        ++i;
      }
    }
  }

  function getDataFeed(
    uint256 key
  ) external view returns (Transmission memory) {
    return historicalDataFeeds[key][counters[key]];
  }

  function getLatestCounter(uint256 key) external view returns (uint256) {
    return counters[key];
  }

  function getFeedAtCounter(
    uint256 key,
    uint256 counter
  ) external view returns (Transmission memory) {
    return historicalDataFeeds[key][counter];
  }
}
