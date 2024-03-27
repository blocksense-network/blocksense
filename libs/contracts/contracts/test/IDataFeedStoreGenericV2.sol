// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IDataFeedStoreGenericV2 {
  error NotAuthorized();
  error WrongInputLength();

  function getDataFeed(uint32 key) external view returns (bytes32);

  function setFeeds(bytes calldata data) external;
}
