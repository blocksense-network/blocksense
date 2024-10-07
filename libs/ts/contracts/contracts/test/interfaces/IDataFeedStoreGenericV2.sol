// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDataFeedStoreGenericV2 {
  function getDataFeed(uint32 key) external view returns (bytes32);

  function setFeeds(bytes calldata data) external;
}
