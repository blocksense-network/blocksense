// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDataFeedStoreGenericV2} from '../interfaces/IDataFeedStoreGenericV2.sol';
import {Consumer} from './Consumer.sol';

contract DataFeedGenericV2Consumer is Consumer {
  constructor(address _dataFeedStore) Consumer(_dataFeedStore) {}

  function _getFeedById(uint32 key) internal view override returns (bytes32) {
    (bool success, bytes memory returnData) = dataFeedStore.staticcall(
      abi.encodeWithSelector(IDataFeedStoreGenericV2.getDataFeed.selector, key)
    );

    if (!success) {
      revert GetFeedByIdFailed();
    }

    return abi.decode(returnData, (bytes32));
  }
}
