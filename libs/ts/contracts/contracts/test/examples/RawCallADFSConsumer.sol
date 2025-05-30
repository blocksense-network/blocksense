// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract RawCallADFSConsumer {
  address public immutable adfs;

  constructor(address _adfs) {
    adfs = _adfs;
  }

  function getLatestSingleData(
    uint256 id
  ) external view returns (bytes32 data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x82), uint128(id))
    );
    require(success, 'ADFS: call failed');

    return (bytes32(returnData));
  }

  function getLatestData(
    uint256 id
  ) external view returns (bytes32[] memory data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x84), uint128(id))
    );
    require(success, 'ADFS: call failed');

    return parseBytesToBytes32Array(returnData);
  }

  function getLatestDataSlice(
    uint256 id,
    uint32 startSlot,
    uint32 slotsCount
  ) external view returns (bytes32[] memory data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x84), uint128(id), startSlot, slotsCount)
    );
    require(success, 'ADFS: call failed');

    return parseBytesToBytes32Array(returnData);
  }

  function getSingleDataAtIndex(
    uint256 id,
    uint256 index
  ) external view returns (bytes32 data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x86), uint128(id), uint16(index))
    );
    require(success, 'ADFS: call failed');

    return (bytes32(returnData));
  }

  function getDataAtIndex(
    uint256 id,
    uint256 index
  ) external view returns (bytes32[] memory data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x86), uint128(id), uint16(index))
    );
    require(success, 'ADFS: call failed');

    return parseBytesToBytes32Array(returnData);
  }

  function getDataSliceAtIndex(
    uint256 id,
    uint256 index,
    uint32 startSlot,
    uint32 slotsCount
  ) external view returns (bytes32[] memory data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(
        bytes1(0x86),
        uint128(id),
        uint16(index),
        startSlot,
        slotsCount
      )
    );
    require(success, 'ADFS: call failed');

    return parseBytesToBytes32Array(returnData);
  }

  function getLatestIndex(uint256 id) external view returns (uint256 index) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x81), uint128(id))
    );
    require(success, 'ADFS: call failed');

    return uint256(bytes32(returnData));
  }

  function getLatestSingleDataAndIndex(
    uint256 id
  ) external view returns (bytes32 data, uint256 index) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x83), uint128(id))
    );
    require(success, 'ADFS: call failed');

    (index, data) = abi.decode(returnData, (uint256, bytes32));
  }

  function getLatestDataAndIndex(
    uint256 id
  ) external view returns (bytes32[] memory data, uint256 index) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x85), uint128(id))
    );
    require(success, 'ADFS: call failed');

    index = uint256(bytes32(returnData));

    assembly {
      let len := mload(returnData)
      returnData := add(returnData, 32)
      mstore(returnData, sub(len, 32))
    }

    data = parseBytesToBytes32Array(returnData);
  }

  function getLatestDataSliceAndIndex(
    uint256 id,
    uint32 startSlot,
    uint32 slotsCount
  ) external view returns (bytes32[] memory data, uint256 index) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x85), uint128(id), startSlot, slotsCount)
    );
    require(success, 'ADFS: call failed');

    index = uint256(bytes32(returnData));

    assembly {
      let len := mload(returnData)
      returnData := add(returnData, 32)
      mstore(returnData, sub(len, 32))
    }

    data = parseBytesToBytes32Array(returnData);
  }

  function parseBytesToBytes32Array(
    bytes memory data
  ) internal pure returns (bytes32[] memory result) {
    uint256 length = data.length;
    result = new bytes32[](length >> 5);

    assembly {
      length := add(length, 32)
      for {
        let i := 32
      } gt(length, i) {
        i := add(i, 32)
      } {
        mstore(add(result, i), mload(add(data, i)))
      }
    }

    return result;
  }
}
