// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDataFeedStoreGenericV1 {
  function getDataFeed(uint256 key) external view returns (bytes32);

  function setFeeds(
    uint256[] calldata _keys,
    bytes32[] calldata _values
  ) external;
}
