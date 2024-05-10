// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import './HistoricDataFeedConsumer.sol';

contract HistoricDataFeedConsumerV2 is HistoricDataFeedConsumer {
  constructor(
    address _dataFeedStore
  ) HistoricDataFeedConsumer(_dataFeedStore) {}

  function _getLatestCounter(
    uint32 key
  ) internal view override returns (uint32 counter) {
    address dataFeed = dataFeedStore;
    // using assembly staticcall costs even less than calling _callDataFeed
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)
      // store selector in memory at location 0
      mstore(0x00, shl(224, or(0x40000000, key)))
      // call dataFeed with selector 0x40000000 | key and store return value at memory location ptr
      let success := staticcall(gas(), dataFeed, 0x00, 4, ptr, 64)
      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }
      // assign return value to counter
      counter := mload(ptr)
    }
  }
}
