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

  function getLatestSingleFeedData(
    uint256 id
  ) external view returns (bytes32 data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x82), uint8(0), uint120(id))
    );
    require(success, 'ADFS: call failed');

    return (bytes32(returnData));
  }

  function getLatestFeedData(
    uint8 stride,
    uint256 id
  ) external view returns (bytes32[] memory data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x84), stride, uint120(id))
    );
    require(success, 'ADFS: call failed');

    return parseBytesToBytes32Array(returnData);
  }

  function getLatestSlicedFeedData(
    uint8 stride,
    uint256 id,
    uint32 startSlot,
    uint32 slotsCount
  ) external view returns (bytes32[] memory data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x84), stride, uint120(id), startSlot, slotsCount)
    );
    require(success, 'ADFS: call failed');

    return parseBytesToBytes32Array(returnData);
  }

  function getSingleFeedDataAtRound(
    uint256 id,
    uint256 round
  ) external view returns (bytes32 data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x86), uint8(0), uint120(id), uint16(round))
    );
    require(success, 'ADFS: call failed');

    return (bytes32(returnData));
  }

  function getFeedDataAtRound(
    uint8 stride,
    uint256 id,
    uint256 round
  ) external view returns (bytes32[] memory data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x86), stride, uint120(id), uint16(round))
    );
    require(success, 'ADFS: call failed');

    return parseBytesToBytes32Array(returnData);
  }

  function getSlicedFeedDataAtRound(
    uint8 stride,
    uint256 id,
    uint256 round,
    uint32 startSlot,
    uint32 slotsCount
  ) external view returns (bytes32[] memory data) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(
        bytes1(0x86),
        stride,
        uint120(id),
        uint16(round),
        startSlot,
        slotsCount
      )
    );
    require(success, 'ADFS: call failed');

    return parseBytesToBytes32Array(returnData);
  }

  function getLatestRound(
    uint8 stride,
    uint256 id
  ) external view returns (uint256 round) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x81), stride, uint120(id))
    );
    require(success, 'ADFS: call failed');

    return uint256(bytes32(returnData));
  }

  function getLatestSingleFeedDataAndRound(
    uint256 id
  ) external view returns (bytes32 data, uint256 round) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x83), uint8(0), uint120(id))
    );
    require(success, 'ADFS: call failed');

    (round, data) = abi.decode(returnData, (uint256, bytes32));
  }

  function getLatestFeedDataAndRound(
    uint8 stride,
    uint256 id
  ) external view returns (bytes32[] memory data, uint256 round) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x85), stride, uint120(id))
    );
    require(success, 'ADFS: call failed');

    round = uint256(bytes32(returnData));

    assembly {
      let len := mload(returnData)
      returnData := add(returnData, 32)
      mstore(returnData, sub(len, 32))
    }

    data = parseBytesToBytes32Array(returnData);
  }

  function getLatestSlicedFeedDataAndRound(
    uint8 stride,
    uint256 id,
    uint32 startSlot,
    uint32 slotsCount
  ) external view returns (bytes32[] memory data, uint256 round) {
    (bool success, bytes memory returnData) = adfs.staticcall(
      abi.encodePacked(bytes1(0x85), stride, uint120(id), startSlot, slotsCount)
    );
    require(success, 'ADFS: call failed');

    round = uint256(bytes32(returnData));

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
