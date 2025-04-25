// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SportsDataFeedStoreGenericV2 {
  mapping(uint256 => bytes32[]) public dataFeeds;
  address public immutable owner;

  event DataFeedSet(uint32 key, bytes32 description);

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

  function setFeeds(
    uint256[] calldata keys,
    bytes32[][] calldata values,
    bytes32[] calldata descriptions
  ) external onlyOwner {
    uint256 keysLength = keys.length;
    if (keysLength != values.length) {
      revert WrongInputLength();
    }

    for (uint i = 0; i < keysLength; ) {
      uint256 key = keys[i];
      dataFeeds[key] = values[i];

      emit DataFeedSet(uint32(key), descriptions[i]);

      unchecked {
        ++i;
      }
    }
  }

  function getDataFeed(uint256 key) external view returns (bytes32[] memory) {
    return dataFeeds[key];
  }
}
