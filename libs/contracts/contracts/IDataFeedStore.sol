// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IDataFeedStore {
  function setFeedById(uint32 _key, bytes32 _value) external;
}
