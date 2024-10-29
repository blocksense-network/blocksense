// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract Consumer {
  address public immutable dataFeedStore;
  mapping(uint32 => bytes32) internal dataFeeds;

  error GetFeedByIdFailed();

  constructor(address _dataFeedStore) {
    dataFeedStore = _dataFeedStore;
  }

  function getFeedById(uint32 key) external view returns (bytes32) {
    return dataFeeds[key];
  }

  function setMultipleFetchedFeedsById(uint32[] calldata keys) external {
    for (uint i = 0; i < keys.length; i++) {
      dataFeeds[keys[i]] = _getFeedById(keys[i]);
    }
  }

  function _getFeedById(
    uint32 key
  ) internal view virtual returns (bytes32 returnData);
}
