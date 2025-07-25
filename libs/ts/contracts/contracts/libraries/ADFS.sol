// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

//    ___  __         __                           _  __    __                  __
//   / _ )/ /__  ____/ /__ ___ ___ ___  ___ ___   / |/ /__ / /__    _____  ____/ /__
//  / _  / / _ \/ __/  '_/(_-</ -_) _ \(_-</ -_) /    / -_) __/ |/|/ / _ \/ __/  '_/
// /____/_/\___/\__/_/\_\/___/\__/_//_/___/\__/ /_/|_/\__/\__/|__,__/\___/_/ /_/\_\
//    _____   ____  ___    ___   ___  ________
//   / __/ | / /  |/  /   / _ | / _ \/ __/ __/
//  / _/ | |/ / /|_/ /   / __ |/ // / _/_\ \
// /___/ |___/_/  /_/   /_/ |_/____/_/ /___/
//
// Website:         https://blocksense.network/
// Git Repository:  https://github.com/blocksense-network/blocksense

/// @title ADFS
/// @author Aneta Tsvetkova
/// @notice Library for calling dataFeedStore functions
/// @dev Contains utility functions for calling gas efficiently dataFeedStore functions and decoding return data
library ADFS {
  /// @notice Gets latest single data for a given feed from the dataFeedStore
  /// @dev This function reads only single data feeds
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @return data The latest stored value
  function getLatestSingleData(
    address dataFeedStore,
    uint256 id
  ) internal view returns (bytes32) {
    return
      _callSingleDataFeed(dataFeedStore, (uint256(0x82) << 248) | (id << 120));
  }

  /// @notice Gets latest data for a given feed from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @return data The latest stored value
  function getLatestData(
    address dataFeedStore,
    uint256 id
  ) internal view returns (bytes32[] memory) {
    return
      _callDataFeed(
        dataFeedStore,
        (uint256(0x84) << 248) | (id << 120),
        17,
        1 << decodeStride(id)
      );
  }

  /// @notice Gets latest data slice for a given feed from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @param startSlot The starting slot to read from
  /// @param slotsCount The number of slots to read
  /// @return data The latest stored value
  function getLatestDataSlice(
    address dataFeedStore,
    uint256 id,
    uint256 startSlot,
    uint256 slotsCount // if this value is 0, then it will return all the slots for the feed starting at startSlot
  ) internal view returns (bytes32[] memory) {
    return
      _callDataFeed(
        dataFeedStore,
        (uint256(0x84) << 248) |
          (id << 120) |
          (startSlot << 88) |
          (slotsCount << 56),
        slotsCount == 0 ? 21 : 25,
        slotsCount > 0 ? slotsCount : (1 << (decodeStride(id) - startSlot))
      );
  }

  /// @notice Gets historical single data at a given index from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID for the feed
  /// @param index The index to retrieve data for
  /// @return data The value stored for the feed at the given index
  function getSingleDataAtIndex(
    address dataFeedStore,
    uint256 id,
    uint256 index
  ) internal view returns (bytes32) {
    return
      _callSingleDataFeed(
        dataFeedStore,
        // 1st byte is function selector
        // after that are 16 bytes of the feed id
        // after the feed id are 2 bytes of the index
        (uint256(0x86) << 248) | (id << 120) | (index << 104)
      );
  }

  /// @notice Gets historical data at a given index from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @param index The index to retrieve data for
  /// @return data The value stored for the feed at the given index
  function getDataAtIndex(
    address dataFeedStore,
    uint256 id,
    uint256 index
  ) internal view returns (bytes32[] memory) {
    return
      _callDataFeed(
        dataFeedStore,
        (uint256(0x86) << 248) | (id << 120) | (index << 104),
        19,
        1 << decodeStride(id)
      );
  }

  /// @notice Gets historical data slice at a given index from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @param index The index to retrieve data for
  /// @param startSlot The starting slot to read from
  /// @param slotsCount The number of slots to read
  /// @return data The value stored for the feed at the given index
  function getDataSliceAtIndex(
    address dataFeedStore,
    uint256 id,
    uint256 index,
    uint256 startSlot,
    uint256 slotsCount // if this value is 0, then it will return all the slots for the feed starting at startSlot
  ) internal view returns (bytes32[] memory) {
    return
      _callDataFeed(
        dataFeedStore,
        (uint256(0x86) << 248) |
          (id << 120) |
          (index << 104) |
          (startSlot << 72) |
          (slotsCount << 40),
        slotsCount == 0 ? 23 : 27,
        slotsCount > 0 ? slotsCount : (1 << (decodeStride(id) - startSlot))
      );
  }

  /// @notice Gets latest index for a given feed from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @return index The latest index
  function getLatestIndex(
    address dataFeedStore,
    uint256 id
  ) internal view returns (uint256) {
    return
      uint256(
        // 1st byte is function selector
        // after that are 16 bytes of the feed id
        _callSingleDataFeed(dataFeedStore, (uint256(0x81) << 248) | (id << 120))
      );
  }

  /// @notice Gets latest single data for a given feed and its latest index from the dataFeedStore
  /// @dev Using assembly achieves lower gas costs
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @return data The latest stored value
  /// @return index The latest index
  function getLatestSingleDataAndIndex(
    address dataFeedStore,
    uint256 id
  ) internal view returns (bytes32 data, uint256 index) {
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)

      // store selector in memory at location 0
      // 1st byte is function selector
      // after that are 16 bytes of the feed id
      mstore(
        0x00,
        or(
          0x8300000000000000000000000000000000000000000000000000000000000000,
          shl(120, id)
        )
      )

      // call dataFeedStore with selector and store return value (64 bytes) at memory location ptr
      let success := staticcall(gas(), dataFeedStore, 0x00, 17, ptr, 64)

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      // load return value from memory at location ptr
      // index is stored in the first 32 bytes of the returned 64 bytes
      index := mload(ptr)

      // value is stored in the second 32 bytes of the returned 64 bytes
      data := mload(add(ptr, 32))
    }
  }

  /// @notice Gets latest data for a given feed and its latest index from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @return data The latest stored value
  /// @return index The latest index
  function getLatestDataAndIndex(
    address dataFeedStore,
    uint256 id
  ) internal view returns (bytes32[] memory data, uint256 index) {
    return
      _callDataFeedAndIndex(
        dataFeedStore,
        (uint256(0x85) << 248) | (id << 120),
        17,
        1 << decodeStride(id)
      );
  }

  /// @notice Gets latest data slice for a given feed and its latest index from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @param startSlot The starting slot to read from
  /// @param slotsCount The number of slots to read
  /// @return data The latest stored value
  /// @return index The latest index
  function getLatestDataSliceAndIndex(
    address dataFeedStore,
    uint256 id,
    uint256 startSlot,
    uint256 slotsCount // if this value is 0, then it will return all the slots for the feed starting at startSlot
  ) internal view returns (bytes32[] memory data, uint256 index) {
    return
      _callDataFeedAndIndex(
        dataFeedStore,
        (uint256(0x85) << 248) |
          (id << 120) |
          (startSlot << 88) |
          (slotsCount << 56),
        slotsCount == 0 ? 23 : 27,
        slotsCount > 0 ? slotsCount : (1 << (decodeStride(id) - startSlot))
      );
  }

  function getEpochSeconds(bytes32 data) internal pure returns (uint64) {
    return uint64(uint256(data)) / 1000;
  }

  function getEpochMilliseconds(bytes32 data) internal pure returns (uint64) {
    return uint64(uint256(data));
  }

  /// @notice Calls the dataFeedStore with the given data for signle data feeds
  /// @dev Using assembly achieves lower gas costs
  /// Used as a call() function to dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param selector The data to call the dataFeedStore with
  /// @return returnData The return value from the dataFeedStore
  function _callSingleDataFeed(
    address dataFeedStore,
    uint256 selector
  ) internal view returns (bytes32 returnData) {
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // store selector in memory at location 0
      mstore(0x00, selector)

      // call dataFeedStore with data and store return value (32 bytes) at memory location ptr
      let success := staticcall(
        gas(), // gas remaining
        dataFeedStore, // address to call
        0x00, // location of data to call
        19, // size of data to call - usually it is 17b but for _getIndexData it is 19b because of the 2 bytes of the index
        returnData, // where to store the return data
        32 // how much data to store
      )

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      // assign loaded return value to returnData
      returnData := mload(returnData)
    }
  }

  /// @notice Calls the dataFeedStore with the given data for bigger feeds
  /// @dev Using assembly achieves lower gas costs
  /// Used as a call() function to dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param selector The data to call the dataFeedStore with
  /// @param selectorLength The length of the selector
  /// @param length The length of the return data
  /// @return returnData The return value
  function _callDataFeed(
    address dataFeedStore,
    uint256 selector,
    uint256 selectorLength,
    uint256 length
  ) internal view returns (bytes32[] memory returnData) {
    returnData = new bytes32[](length);
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // store selector in memory at location 0
      mstore(0x00, selector)

      // call dataFeedStore with data and store return value (32 bytes) at memory location ptr
      let success := staticcall(
        gas(), // gas remaining
        dataFeedStore, // address to call
        0x00, // location of data to call
        selectorLength, // size of data to call - usually it is 19b but for _getIndexData it is 21b because of the 2 bytes of the index
        add(returnData, 32), // where to store the return data
        shl(5, length) // how much data to store
      )

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }
    }
  }

  /// @notice Calls the dataFeedStore with the given data for bigger feeds
  /// @dev Using assembly achieves lower gas costs
  /// Used as a call() function to dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param selector The data to call the dataFeedStore with
  /// @param selectorLength The length of the selector
  /// @param length The length of the return data
  /// @return returnData The return value
  /// @return index The latest index
  function _callDataFeedAndIndex(
    address dataFeedStore,
    uint256 selector,
    uint256 selectorLength,
    uint256 length
  ) internal view returns (bytes32[] memory returnData, uint256 index) {
    returnData = new bytes32[](length);
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // store selector in memory at location 0
      mstore(0x00, selector)

      // call dataFeedStore with data and store return value (32 bytes) at memory location ptr
      let success := staticcall(
        gas(), // gas remaining
        dataFeedStore, // address to call
        0x00, // location of data to call
        selectorLength, // size of data to call - usually it is 19b but for _getIndexData it is 21b because of the 2 bytes of the index
        returnData, // where to store the return data
        add(shl(5, length), 32) // how much data to store
      )

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      // load return value from memory at location ptr
      // index is stored in the first 32 bytes of the returned 64 bytes
      index := mload(returnData)
      mstore(returnData, length)
    }
  }

  /// @notice Decodes the return data from the dataFeedStore
  /// This function can be used to separate the value and timestamp from the return data
  /// This is useful for feeds that return prices
  /// @param data The data to decode
  /// @return answer The value stored for the feed at the given index
  /// @return timestamp The timestamp when the value was stored
  function decodeData(bytes32 data) internal pure returns (uint256, uint256) {
    return (uint256(uint192(bytes24(data))), uint64(uint256(data)));
  }

  /// @notice Decodes the stride from the feed id
  /// @dev The first 3 bits of the stride are reserved for access control
  /// There are only 32 strides (from 0 to 31 incl.) so only the last 5 bits are used to determine the stride
  /// @param id The id of the feed
  /// @return stride The stride of the feed
  function decodeStride(uint256 id) internal pure returns (uint256) {
    return (id >> 120) & 0x1f;
  }
}
