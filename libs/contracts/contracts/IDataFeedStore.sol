// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IDataFeedStore {
  function setFeedById(uint32 key, bytes32 value) external;
  function setFeeds(bytes calldata) external;
}
