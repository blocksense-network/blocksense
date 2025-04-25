// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import './HistoricalConsumer.sol';
import {BlocksenseExp} from '../../../../experiments/libraries/BlocksenseExp.sol';

contract HistoricalDataFeedConsumer is HistoricalConsumer {
  constructor(address _dataFeedStore) HistoricalConsumer(_dataFeedStore) {}

  function _getFeedById(
    uint32 key
  ) internal view override returns (Transmission memory) {
    return
      _decodeTransmission(
        BlocksenseExp._callDataFeed(
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
        BlocksenseExp._callDataFeed(
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
    return uint32(BlocksenseExp._latestRound(key, dataFeedStore));
  }
}
