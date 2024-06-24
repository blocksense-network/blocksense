// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract EncodingBase {
  bytes public storedData;

  event Encoded(bytes data);
  event Decoded(uint32 d1, uint32 d2, bytes32 d3);

  function storeEncodedData(bytes memory data) external {
    storedData = data;
  }

  function encode(uint32 d1, uint32 d2, bytes32 d3) external virtual;

  function decode(bytes calldata data) external virtual;

  function decodeFromStorage() external virtual;
}
