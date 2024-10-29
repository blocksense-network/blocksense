// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Blocksense} from '../../libraries/Blocksense.sol';

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract BlocksenseFeedStoreConsumer {
  address public immutable feed;

  constructor(address feedAddress) {
    feed = feedAddress;
  }

  function getLatestAnswer(
    uint32 key
  ) external view returns (uint256 value, uint64 timestamp) {
    bytes32 data = Blocksense._callDataFeed(
      feed,
      abi.encodePacked(0x80000000 | key)
    );

    return (uint256(uint192(bytes24(data))), uint64(uint256(data)));
  }

  function getRoundData(
    uint32 key,
    uint32 roundId
  ) external view returns (uint256 value, uint64 timestamp) {
    bytes32 data = Blocksense._callDataFeed(
      feed,
      abi.encodeWithSelector(bytes4(0x20000000 | key), roundId)
    );

    return (uint256(uint192(bytes24(data))), uint64(uint256(data)));
  }

  function getLatestRound(uint32 key) external view returns (uint32 roundId) {
    return uint32(Blocksense._latestRound(key, feed));
  }

  function getLatestRoundData(
    uint32 key
  ) external view returns (int256 value, uint256 timestamp, uint80 roundId) {
    (roundId, value, timestamp, , ) = Blocksense._latestRoundData(key, feed);
  }
}
