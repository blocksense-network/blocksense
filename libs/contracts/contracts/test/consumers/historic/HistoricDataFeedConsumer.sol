// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import './HistoricConsumer.sol';
import {ProxyCall} from '../../../libraries/ProxyCall.sol';

contract HistoricDataFeedConsumer is HistoricConsumer {
  constructor(address _dataFeedStore) HistoricConsumer(_dataFeedStore) {}

  function _getFeedById(
    uint32 key
  ) internal view override returns (Transmission memory) {
    return
      _decodeTransmission(
        ProxyCall._callDataFeed(
          dataFeedStore,
          abi.encodePacked(0x80000000 | key)
        )
      );
  }

  function _getFeedAtCounter(
    uint32 key,
    uint32 counter
  ) internal view override returns (Transmission memory) {
    return
      _decodeTransmission(
        ProxyCall._callDataFeed(
          dataFeedStore,
          abi.encodeWithSelector(bytes4(0x20000000 | key), counter)
        )
      );
  }

  function _decodeTransmission(
    bytes32 data
  ) internal pure returns (Transmission memory data_) {
    data_.value = bytes24(data);
    data_.timestamp = uint64(uint256(data));
  }

  function _getLatestCounter(
    uint32 key
  ) internal view override returns (uint32 counter) {
    return uint32(ProxyCall._latestRound(key, dataFeedStore));
  }
}
