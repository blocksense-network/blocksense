// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract DataFeedStoreGeneric {
  mapping(uint256 => bytes32) public dataFeeds;
  address public immutable owner;

  error NotAuthorized();
  error WrongInputLength();

  constructor() {
    owner = msg.sender;
  }

  modifier onlyOwner() {
    if (msg.sender != owner) {
      revert NotAuthorized();
    }
    _;
  }
}
