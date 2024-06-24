// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import './EncodingBase.sol';

contract RefEncoding is EncodingBase {
  function encode(uint32 d1, uint32 d2, bytes32 d3) external override {
    emit Encoded(abi.encode(d1, d2, d3));
  }

  function decode(bytes calldata data) external override {
    (uint32 d1, uint32 d2, bytes32 d3) = abi.decode(
      data,
      (uint32, uint32, bytes32)
    );
    emit Decoded(d1, d2, d3);
  }

  function decodeFromStorage() external override {
    (uint32 d1, uint32 d2, bytes32 d3) = abi.decode(
      storedData,
      (uint32, uint32, bytes32)
    );
    emit Decoded(d1, d2, d3);
  }
}
