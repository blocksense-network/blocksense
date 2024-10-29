// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import './HistoricalConsumer.sol';
import {HistoricalDataFeedStoreGenericV1} from '../../HistoricalDataFeedStoreGenericV1.sol';

contract HistoricalDataFeedGenericConsumer is HistoricalConsumer {
  constructor(address _dataFeedStore) HistoricalConsumer(_dataFeedStore) {}

  function _getFeedById(
    uint32 key
  ) internal view override returns (Transmission memory) {
    return HistoricalDataFeedStoreGenericV1(dataFeedStore).getDataFeed(key);
  }

  function _getLatestCounter(
    uint32 key
  ) internal view override returns (uint32) {
    return
      uint32(
        HistoricalDataFeedStoreGenericV1(dataFeedStore).getLatestCounter(key)
      );
  }

  function _getFeedAtCounter(
    uint32 key,
    uint32 counter
  ) internal view override returns (Transmission memory) {
    return
      HistoricalDataFeedStoreGenericV1(dataFeedStore).getFeedAtCounter(
        key,
        counter
      );
  }
}
