// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import './BytesLib.sol';

library SportsDecoder {
  struct FootballData {
    uint32 homeScore;
    uint32 awayScore;
    uint32 homeShots;
    uint32 awayShots;
    uint32 homePenalties;
    uint32 awayPenalties;
    uint32 homeSaves;
    uint32 awaySaves;
    uint32 homeFirstHalfTimeScore;
    uint32 awayFirstHalfTimeScore;
  }

  struct BasketballData {
    uint32 homeScore;
    uint32 awayScore;
    uint32 homeShots;
    uint32 awayShots;
    uint32 homeBlocks;
    uint32 awayBlocks;
    uint32 homeSteals;
    uint32 awaySteals;
    uint32 homeTurnovers;
    uint32 awayTurnovers;
    uint32 homeFirstQtrScore;
    uint32 awayFirstQtrScore;
    uint32 homeSecondQtrScore;
    uint32 awaySecondQtrScore;
    uint32 homeThirdQtrScore;
    uint32 awayThirdQtrScore;
    uint32 homeFourthQtrScore;
    uint32 awayFourthQtrScore;
  }

  function decodeFootballData(
    uint32 key,
    address dataFeedStore
  ) internal returns (FootballData memory) {
    bytes memory data = fetchData(key, 2, dataFeedStore);

    uint256 decoded1 = BytesLib.toUint256(data, 0);
    uint256 decoded2 = BytesLib.toUint256(data, 32);
    return
      FootballData(
        uint32(decoded1 >> 224),
        uint32(decoded1 >> 192),
        uint32(decoded1 >> 160),
        uint32(decoded1 >> 128),
        uint32(decoded1 >> 96),
        uint32(decoded1 >> 64),
        uint32(decoded1 >> 32),
        uint32(decoded1),
        uint32(decoded2 >> 32),
        uint32(decoded2)
      );
  }

  function decodeBasketballData(
    uint32 key,
    address dataFeedStore
  ) internal returns (BasketballData memory) {
    bytes memory data = fetchData(key, 3, dataFeedStore);
    uint256 decoded1 = BytesLib.toUint256(data, 0);
    uint256 decoded2 = BytesLib.toUint256(data, 32);
    uint256 decoded3 = BytesLib.toUint256(data, 64);

    return
      BasketballData(
        uint32(decoded1 >> 224),
        uint32(decoded1 >> 192),
        uint32(decoded1 >> 160),
        uint32(decoded1 >> 128),
        uint32(decoded1 >> 96),
        uint32(decoded1 >> 64),
        uint32(decoded1 >> 32),
        uint32(decoded1),
        uint32(decoded2 >> 224),
        uint32(decoded2 >> 192),
        uint32(decoded2 >> 160),
        uint32(decoded2 >> 128),
        uint32(decoded2 >> 96),
        uint32(decoded2 >> 64),
        uint32(decoded2 >> 32),
        uint32(decoded2),
        uint32(decoded3 >> 32),
        uint32(decoded3)
      );
  }

  function fetchData(
    uint32 key,
    uint256 slotsCount,
    address dataFeedStore
  ) internal view returns (bytes memory returnData) {
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)

      // store selector in memory at location 0
      mstore(0x00, shl(224, or(0x80000000, key)))
      mstore(0x04, slotsCount)

      // call dataFeedStore with selector 0x80000000 | key (4 bytes) + len (32 bytes) and store return value (slotsCount * 32 bytes) at memory location ptr
      let success := staticcall(
        gas(),
        dataFeedStore,
        0,
        36,
        ptr,
        mul(slotsCount, 32)
      )

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      for {
        let i := 0x00
      } lt(i, slotsCount) {
        i := add(i, 0x01)
      } {
        // mload value for returnData
        let pos := mul(i, 0x20)
        mstore(add(add(returnData, pos), 32), mload(add(ptr, pos)))
      }
      mstore(returnData, add(mload(returnData), mul(slotsCount, 32)))
    }
  }
}
