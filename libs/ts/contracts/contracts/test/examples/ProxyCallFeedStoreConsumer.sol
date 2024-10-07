// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProxyCall} from '../../libraries/ProxyCall.sol';

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract ProxyCallFeedStoreConsumer {
  address public immutable feed;

  constructor(address feedAddress) {
    feed = feedAddress;
  }

  function getLatestAnswer(
    uint32 key
  ) external view returns (uint256 value, uint64 timestamp) {
    bytes32 data = ProxyCall._callDataFeed(
      feed,
      abi.encodePacked(0x80000000 | key)
    );

    return (uint256(uint192(bytes24(data))), uint64(uint256(data)));
  }

  function getRoundData(
    uint32 key,
    uint32 roundId
  ) external view returns (uint256 value, uint64 timestamp) {
    bytes32 data = ProxyCall._callDataFeed(
      feed,
      abi.encodeWithSelector(bytes4(0x20000000 | key), roundId)
    );

    return (uint256(uint192(bytes24(data))), uint64(uint256(data)));
  }

  function getLatestRound(uint32 key) external view returns (uint32 roundId) {
    return uint32(ProxyCall._latestRound(key, feed));
  }

  function getLatestRoundData(
    uint32 key
  ) external view returns (int256 value, uint256 timestamp, uint80 roundId) {
    (roundId, value, timestamp, , ) = ProxyCall._latestRoundData(key, feed);
  }
}
