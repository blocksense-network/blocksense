// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHistoricalDataFeed} from '../../interfaces/IHistoricalDataFeed.sol';

abstract contract HistoricalConsumer is IHistoricalDataFeed {
  address public immutable dataFeedStore;
  mapping(uint32 => mapping(uint32 => Transmission)) internal dataFeeds;
  mapping(uint32 => uint32) public counters;
  mapping(uint32 => Transmission) public latestDataFeeds;

  error GetFeedByIdFailed();

  constructor(address _dataFeedStore) {
    dataFeedStore = _dataFeedStore;
  }

  function getFeedById(uint32 key) external view returns (Transmission memory) {
    return dataFeeds[key][counters[key]];
  }

  function getFeedAtCounter(
    uint32 key,
    uint32 counter
  ) external view returns (Transmission memory) {
    return dataFeeds[key][counter];
  }

  function setMultipleFetchedFeedsById(uint32[] calldata keys) external {
    for (uint i = 0; i < keys.length; i++) {
      uint32 counter = _getLatestCounter(keys[i]);
      dataFeeds[keys[i]][counter] = _getFeedById(keys[i]);
      counters[keys[i]] = counter;
    }
  }

  function setMultipleLatestFeedsById(uint32[] calldata keys) external {
    for (uint i = 0; i < keys.length; i++) {
      latestDataFeeds[keys[i]] = _getFeedById(keys[i]);
    }
  }

  function setMultipleFeedsAtCounter(
    uint32[] calldata keys,
    uint32[] calldata counters_
  ) external {
    for (uint i = 0; i < keys.length; i++) {
      dataFeeds[keys[i]][counters_[i]] = _getFeedAtCounter(
        keys[i],
        counters_[i]
      );
    }
  }

  function _getFeedById(
    uint32 key
  ) internal view virtual returns (Transmission memory);

  function _getLatestCounter(uint32 key) internal view virtual returns (uint32);

  function _getFeedAtCounter(
    uint32 key,
    uint32 counter
  ) internal view virtual returns (Transmission memory);
}
