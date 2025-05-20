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

  function getLatestSingleFeedData(uint256 id) external view returns (bytes32) {
    return ADFS._getLatestSingleFeedData(adfs, id);
  }

  function getLatestFeedData(
    uint256 stride,
    uint256 id
  ) external view returns (bytes32[] memory) {
    return ADFS._getLatestFeedData(adfs, stride, id);
  }

  function getLatestSlicedFeedData(
    uint256 stride,
    uint256 id,
    uint256 startSlot,
    uint256 slotsCount
  ) external view returns (bytes32[] memory) {
    return
      ADFS._getLatestSlicedFeedData(
        adfs,
        stride,
        id,
        startSlot,
        slotsCount
      );
  }

  function getLatestRound(
    uint256 stride,
    uint256 id
  ) external view returns (uint256 round) {
    return ADFS._getLatestRound(adfs, stride, id);
  }

  function getSingleFeedDataAtRound(
    uint256 id,
    uint256 round
  ) external view returns (bytes32) {
    return ADFS._getSingleFeedDataAtRound(adfs, id, round);
  }

  function getFeedDataAtRound(
    uint256 stride,
    uint256 id,
    uint256 round
  ) external view returns (bytes32[] memory) {
    return ADFS._getFeedDataAtRound(adfs, stride, id, round);
  }

  function getSlicedFeedDataAtRound(
    uint256 stride,
    uint256 id,
    uint256 round,
    uint256 startSlot,
    uint256 slotsCount
  ) external view returns (bytes32[] memory) {
    return
      ADFS._getSlicedFeedDataAtRound(
        adfs,
        stride,
        id,
        round,
        startSlot,
        slotsCount
      );
  }

  function getLatestSingleFeedDataAndRound(
    uint256 id
  ) external view returns (bytes32 data, uint256 round) {
    return ADFS._getLatestSingleFeedDataAndRound(adfs, id);
  }

  function getLatestFeedDataAndRound(
    uint256 stride,
    uint256 id
  ) external view returns (bytes32[] memory data, uint256 round) {
    return ADFS._getLatestFeedDataAndRound(adfs, stride, id);
  }

  function getLatestSlicedFeedDataAndRound(
    uint256 stride,
    uint256 id,
    uint256 startSlot,
    uint256 slotsCount
  ) external view returns (bytes32[] memory data, uint256 round) {
    return
      ADFS._getLatestSlicedFeedDataAndRound(
        adfs,
        stride,
        id,
        startSlot,
        slotsCount
      );
  }

  function getEpochSeconds(uint256 id) external view returns (uint64) {
    return
      ADFS._getEpochSeconds(
        ADFS._getLatestSingleFeedData(adfs, id)
      );
  }

  function getEpochMilliseconds(uint256 id) external view returns (uint64) {
    return
      ADFS._getEpochMilliseconds(
        ADFS._getLatestSingleFeedData(adfs, id)
      );
  }
}
