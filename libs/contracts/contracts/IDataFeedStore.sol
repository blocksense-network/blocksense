// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IDataFeedStore {
  function setFeeds(bytes calldata) external;
}
