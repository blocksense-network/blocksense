// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract RawCallFeedStoreConsumer {
  address public immutable feed;

  constructor(address feedAddress) {
    feed = feedAddress;
  }

  function getLatestAnswer(
    uint32 key
  ) external view returns (uint256 value, uint64 timestamp) {
    (bool success, bytes memory returnData) = feed.staticcall(
      abi.encodePacked(0x80000000 | key)
    );
    require(success, 'DataFeedStore: call failed');

    bytes32 data = bytes32(returnData);
    return (uint256(uint192(bytes24(data))), uint64(uint256(data)));
  }

  function getRoundData(
    uint32 key,
    uint32 roundId
  ) external view returns (uint256 value, uint64 timestamp) {
    (bool success, bytes memory returnData) = feed.staticcall(
      abi.encodeWithSelector(bytes4(0x20000000 | key), roundId)
    );
    require(success, 'DataFeedStore: call failed');

    bytes32 data = bytes32(returnData);
    return (uint256(uint192(bytes24(data))), uint64(uint256(data)));
  }

  function getLatestRound(uint32 key) external view returns (uint32 roundId) {
    (bool success, bytes memory returnData) = feed.staticcall(
      abi.encodePacked(0x40000000 | key)
    );
    require(success, 'DataFeedStore: call failed');

    return uint32(uint256(bytes32(returnData)));
  }

  function getLatestRoundData(
    uint32 key
  ) external view returns (uint256 value, uint64 timestamp, uint256 roundId) {
    (bool success, bytes memory returnData) = feed.staticcall(
      abi.encodePacked(0xc0000000 | key)
    );
    require(success, 'DataFeedStore: call failed');

    value = uint256(uint192(bytes24(returnData)));
    timestamp = uint64(uint256(bytes32(returnData)));
    assembly {
      returnData := add(returnData, 0x20)
    }
    roundId = uint256(bytes32(returnData));
  }
}
