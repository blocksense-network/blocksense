// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import './HistoricDataFeedConsumer.sol';
import {ProxyCallV1} from '../../../libraries/ProxyCallV1.sol';

contract HistoricDataFeedConsumerV1 is HistoricDataFeedConsumer {
  constructor(
    address _dataFeedStore
  ) HistoricDataFeedConsumer(_dataFeedStore) {}

  function _getLatestCounter(
    uint32 key
  ) internal view override returns (uint32 counter) {
    return uint32(ProxyCallV1._latestRound(key, dataFeedStore));
  }
}
