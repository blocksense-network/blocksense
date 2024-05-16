// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import './HistoricDataFeedConsumer.sol';
import {ProxyCallV2} from '../../../libraries/ProxyCallV2.sol';

contract HistoricDataFeedConsumerV2 is HistoricDataFeedConsumer {
  constructor(
    address _dataFeedStore
  ) HistoricDataFeedConsumer(_dataFeedStore) {}

  function _getLatestCounter(
    uint32 key
  ) internal view override returns (uint32 counter) {
    return uint32(ProxyCallV2._latestRound(key, dataFeedStore));
  }
}
