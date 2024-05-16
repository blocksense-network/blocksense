// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ProxyCall} from './ProxyCall.sol';

library ProxyCallV2 {
  function _latestRound(
    uint32 key,
    address dataFeedStore
  ) internal view returns (uint256) {
    return
      uint256(
        ProxyCall._callDataFeed(
          dataFeedStore,
          abi.encodePacked(0x40000000 | key)
        )
      );
  }

  function _latestRoundData(
    uint32 key,
    address dataFeedStore
  )
    internal
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256, uint80)
  {
    roundId = uint80(
      uint256(
        (
          ProxyCall._callDataFeed(
            dataFeedStore,
            abi.encodePacked(0x40000000 | key)
          )
        )
      )
    );
    (answer, startedAt) = ProxyCall._decodeData(
      ProxyCall._callDataFeed(
        dataFeedStore,
        abi.encodeWithSelector(bytes4(0x20000000 | key), roundId)
      )
    );

    return (roundId, answer, startedAt, startedAt, roundId);
  }
}
