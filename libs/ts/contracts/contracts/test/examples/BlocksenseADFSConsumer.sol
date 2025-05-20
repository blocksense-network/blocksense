// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ADFS} from '../../libraries/ADFS.sol';

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract ADFSConsumer {
  address public immutable adfs;

  constructor(address _adfs) {
    adfs = _adfs;
  }

  function getLatestSingleData(uint256 id) external view returns (bytes32) {
    return ADFS.getLatestSingleData(adfs, id);
  }

  function getLatestData(
    uint256 stride,
    uint256 id
  ) external view returns (bytes32[] memory) {
    return ADFS.getLatestData(adfs, stride, id);
  }

  function getLatestDataSlice(
    uint256 stride,
    uint256 id,
    uint256 startSlot,
    uint256 slotsCount
  ) external view returns (bytes32[] memory) {
    return ADFS.getLatestDataSlice(adfs, stride, id, startSlot, slotsCount);
  }

  function getLatestIndex(
    uint256 stride,
    uint256 id
  ) external view returns (uint256 round) {
    return ADFS.getLatestIndex(adfs, stride, id);
  }

  function getSingleDataAtIndex(
    uint256 id,
    uint256 index
  ) external view returns (bytes32) {
    return ADFS.getSingleDataAtIndex(adfs, id, index);
  }

  function getDataAtIndex(
    uint256 stride,
    uint256 id,
    uint256 index
  ) external view returns (bytes32[] memory) {
    return ADFS.getDataAtIndex(adfs, stride, id, index);
  }

  function getDataSliceAtIndex(
    uint256 stride,
    uint256 id,
    uint256 index,
    uint256 startSlot,
    uint256 slotsCount
  ) external view returns (bytes32[] memory) {
    return
      ADFS.getDataSliceAtIndex(adfs, stride, id, index, startSlot, slotsCount);
  }

  function getLatestSingleDataAndIndex(
    uint256 id
  ) external view returns (bytes32 data, uint256 index) {
    return ADFS.getLatestSingleDataAndIndex(adfs, id);
  }

  function getLatestDataAndIndex(
    uint256 stride,
    uint256 id
  ) external view returns (bytes32[] memory data, uint256 index) {
    return ADFS.getLatestDataAndIndex(adfs, stride, id);
  }

  function getLatestDataSliceAndIndex(
    uint256 stride,
    uint256 id,
    uint256 startSlot,
    uint256 slotsCount
  ) external view returns (bytes32[] memory data, uint256 index) {
    return
      ADFS.getLatestDataSliceAndIndex(adfs, stride, id, startSlot, slotsCount);
  }

  function getEpochSeconds(uint256 id) external view returns (uint64) {
    return ADFS.getEpochSeconds(ADFS.getLatestSingleData(adfs, id));
  }

  function getEpochMilliseconds(uint256 id) external view returns (uint64) {
    return ADFS.getEpochMilliseconds(ADFS.getLatestSingleData(adfs, id));
  }
}
