// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Consumer} from './Consumer.sol';

contract DataFeedV2Consumer is Consumer {
  constructor(address _dataFeedStore) Consumer(_dataFeedStore) {}

  function _getFeedById(
    uint32 key
  ) internal view override returns (bytes32 returnData) {
    address dataFeed = dataFeedStore;

    // using assembly staticcall costs less gas than using a view function
    assembly {
      let ptr := mload(0x40) // get free memory pointer
      mstore(0x00, shl(224, or(0x80000000, key)))
      let success := staticcall(gas(), dataFeed, 0x00, 4, ptr, 32)
      if iszero(success) {
        revert(0, 0)
      }
      returnData := mload(ptr)
    }
  }
}
