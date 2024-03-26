// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract DataFeedStoreBasic {
  mapping(uint256 => bytes32) public dataFeeds;
  address public immutable owner;

  constructor() {
    owner = msg.sender;
  }

  function setFeedById(uint256 _key, bytes32 _value) external {
    dataFeeds[_key] = _value;
  }

  function setFeeds(
    uint256[] calldata _keys,
    bytes32[] calldata _values
  ) external {
    require(msg.sender == owner, 'DataFeedStoreBasic: sender is not owner');
    require(
      _keys.length == _values.length,
      'DataFeedStoreBasic: keys and values length mismatch'
    );

    for (uint i = 0; i < _keys.length; ) {
      dataFeeds[_keys[i]] = _values[i];
      unchecked {
        ++i;
      }
    }
  }

  function getDataFeed(uint256 _key) external view returns (bytes32) {
    return dataFeeds[_key];
  }
}
