// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IDataFeedStoreGenericV2} from '../interfaces/IDataFeedStoreGenericV2.sol';

contract DataFeedGenericV2Consumer {
  IDataFeedStoreGenericV2 public immutable dataFeedStoreV2;
  mapping(uint32 => bytes32) internal dataFeeds;

  error GetFeedByIdFailed();

  constructor(address _dataFeedStore) {
    dataFeedStoreV2 = IDataFeedStoreGenericV2(_dataFeedStore);
  }

  function getExternalFeedById(uint32 key) external view returns (bytes32) {
    return _getFeedById(key);
  }

  function getFeedById(uint32 key) external view returns (bytes32) {
    return dataFeeds[key];
  }

  function setMultipleFetchedFeedsById(uint32[] calldata keys) external {
    for (uint i = 0; i < keys.length; i++) {
      _setFetchedFeedById(keys[i]);
    }
  }

  function _setFetchedFeedById(uint32 key) internal {
    dataFeeds[key] = bytes32(_getFeedById(key));
  }

  function _getFeedById(uint32 key) internal view returns (bytes32) {
    (bool success, bytes memory returnData) = address(dataFeedStoreV2)
      .staticcall(
        abi.encodeWithSelector(
          IDataFeedStoreGenericV2.getDataFeed.selector,
          key
        )
      );

    if (!success) {
      revert GetFeedByIdFailed();
    }

    return abi.decode(returnData, (bytes32));
  }
}
