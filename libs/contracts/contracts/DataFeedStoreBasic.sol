// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import 'hardhat/console.sol';

contract DataFeedStoreBasic {
  mapping(uint => bytes32) public dataFeeds;

  function setFeedById(uint256 _key, bytes32 _value) external {
    uint gasStart = gasleft();
    dataFeeds[_key] = _value;
    console.log('Gas used: %d', gasStart - gasleft());
  }

  function getDataFeed(uint256 _key) external view returns (bytes32) {
    return dataFeeds[_key];
  }
}
