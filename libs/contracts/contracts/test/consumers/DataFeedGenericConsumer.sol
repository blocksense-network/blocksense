// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IDataFeedStoreGeneric} from '../IDataFeedStoreGeneric.sol';

contract DataFeedGenericConsumer {
  IDataFeedStoreGeneric public immutable dataFeedStore;
  mapping(uint32 => bytes32) public dataFeeds;

  error GetFeedByIdFailed();

  constructor(address _dataFeedStore) {
    dataFeedStore = IDataFeedStoreGeneric(_dataFeedStore);
  }

  function getExternalFeedById(uint32 key) external view returns (bytes32) {
    return _getFeedById(key);
  }

  function getFeedById(uint32 key) external view returns (bytes32) {
    return dataFeeds[key];
  }

  function setFetchedFeedById(uint32 key) external {
    dataFeeds[key] = _getFeedById(key);
  }

  function setMultipleFetchedFeedsById(uint32[] calldata keys) external {
    for (uint i = 0; i < keys.length; i++) {
      dataFeeds[keys[i]] = _getFeedById(keys[i]);
    }
  }

  function _getFeedById(uint32 key) internal view returns (bytes32) {
    (bool success, bytes memory returnData) = address(dataFeedStore).staticcall(
      abi.encodeWithSelector(IDataFeedStoreGeneric.getDataFeed.selector, key)
    );

    if (!success) {
      revert GetFeedByIdFailed();
    }

    return abi.decode(returnData, (bytes32));
  }
}
