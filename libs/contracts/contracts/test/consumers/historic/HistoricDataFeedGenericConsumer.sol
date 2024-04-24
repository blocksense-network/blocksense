// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import './HistoricConsumer.sol';
import {HistoricDataFeedStoreGenericV1} from '../../HistoricDataFeedStoreGenericV1.sol';

contract HistoricDataFeedGenericConsumer is HistoricConsumer {
  constructor(address _dataFeedStore) HistoricConsumer(_dataFeedStore) {}

  function _getFeedById(
    uint32 key
  ) internal view override returns (Transmission memory) {
    return HistoricDataFeedStoreGenericV1(dataFeedStore).getDataFeed(key);
  }

  function _getLatestCounter(
    uint32 key
  ) internal view override returns (uint32) {
    return
      uint32(
        HistoricDataFeedStoreGenericV1(dataFeedStore).getLatestCounter(key)
      );
  }

  function _getFeedAtCounter(
    uint32 key,
    uint32 counter
  ) internal view override returns (Transmission memory) {
    return
      HistoricDataFeedStoreGenericV1(dataFeedStore).getFeedAtCounter(
        key,
        counter
      );
  }
}
