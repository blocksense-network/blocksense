// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract DataFeedV1Consumer {
  address public immutable dataFeedStore;
  mapping(uint32 => bytes32) internal dataFeeds;

  error GetFeedByIdFailed();

  constructor(address _dataFeedStore) {
    dataFeedStore = _dataFeedStore;
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
    dataFeeds[key] = _getFeedById(key);
  }

  function _getFeedById(uint32 key) internal view returns (bytes32 returnData) {
    address dataFeed = dataFeedStore;

    // using assembly staticcall costs less gas than using a view function
    assembly {
      let ptr := mload(0x40) // get free memory pointer
      mstore(0x00, shl(224, key))
      let success := staticcall(gas(), dataFeed, 0x00, 4, ptr, 32)
      if iszero(success) {
        revert(0, 0)
      }
      returnData := mload(ptr)
    }
  }
}
