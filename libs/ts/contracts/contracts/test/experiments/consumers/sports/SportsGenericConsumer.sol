// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SportsDecoder} from '../../libraries/SportsDecoder.sol';

abstract contract SportsGenericConsumer {
  address internal immutable dataFeedStore;

  event DataDecoded();

  constructor(address _dataFeedStore) {
    dataFeedStore = _dataFeedStore;
  }

  function _decodeFootballData(
    bytes32[] memory data
  ) internal returns (SportsDecoder.FootballData memory) {
    emit DataDecoded();

    uint256 decoded1 = uint256(data[0]);
    uint256 decoded2 = uint256(data[1]);

    return
      SportsDecoder.FootballData(
        uint32(decoded1 >> 224),
        uint32(decoded1 >> 192),
        uint32(decoded1 >> 160),
        uint32(decoded1 >> 128),
        uint32(decoded1 >> 96),
        uint32(decoded1 >> 64),
        uint32(decoded1 >> 32),
        uint32(decoded1),
        uint32(decoded2 >> 224),
        uint32(decoded2 >> 192)
      );
  }

  function _decodeBasketballData(
    bytes32[] memory data
  ) internal returns (SportsDecoder.BasketballData memory) {
    emit DataDecoded();

    uint256 decoded1 = uint256(data[0]);
    uint256 decoded2 = uint256(data[1]);
    uint256 decoded3 = uint256(data[2]);
    return
      SportsDecoder.BasketballData(
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
        uint32(decoded3 >> 224),
        uint32(decoded3 >> 192)
      );
  }
}
