// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import './libraries/BytesLib.sol';
import './EncodingBase.sol';

contract PackedEncoding is EncodingBase {
  function encode(uint32 d1, uint32 d2, bytes32 d3) external override {
    emit Encoded(abi.encodePacked(d1, d2, d3));
  }

  function decode(bytes memory data) public override {
    uint64 d12 = BytesLib.toUint64(data, 0);
    bytes32 d3 = BytesLib.toBytes32(data, 8);
    emit Decoded(uint32(d12), uint32(d12 << 32), d3);
  }

  function decodeFromStorage() external override {
    bytes memory data = storedData;
    uint64 d12 = BytesLib.toUint64(data, 0);
    bytes32 d3 = BytesLib.toBytes32(data, 8);
    emit Decoded(uint32(d12), uint32(d12 << 32), d3);
  }
}
