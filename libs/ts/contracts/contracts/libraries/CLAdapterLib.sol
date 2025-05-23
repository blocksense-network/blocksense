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

/// @title CLAdapterLib
/// @author Aneta Tsvetkova
/// @notice Library for calling dataFeedStore functions for Chainlink adapters
/// @dev Contains utility functions for calling gas efficiently dataFeedStore functions and decoding return data
library CLAdapterLib {
  /// @notice Gets the latest answer from the dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param id The ID of the feed
  /// @return answer The latest stored value after being decoded
  function latestAnswer(
    uint256 id,
    address dataFeedStore
  ) internal view returns (int256) {
    return
      int256(
        uint256(
          uint192(
            bytes24(
              // 1st byte is function selector
              // after that are 16 bytes of the feed id
              _callDataFeed(dataFeedStore, (uint256(0x82) << 248) | id)
            )
          )
        )
      );
  }

  /// @notice Gets the round data from the dataFeedStore
  /// @param _roundId The round ID to retrieve data for
  /// @param id The ID of the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The round ID
  /// @return answer The value stored for the feed at the given round ID
  /// @return startedAt The timestamp when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
  function getRoundData(
    uint80 _roundId,
    uint256 id,
    address dataFeedStore
  )
    internal
    view
    returns (uint80, int256 answer, uint256 startedAt, uint256, uint80)
  {
    (answer, startedAt) = _decodeData(
      _callDataFeed(
        dataFeedStore,
        // 1st byte is function selector
        // after that are 16 bytes of the feed id
        // after the feed id are 2 bytes of the round id
        (uint256(0x86) << 248) | id | (uint256(_roundId) << 104)
      )
    );
    return (_roundId, answer, startedAt, startedAt, _roundId);
  }

  /// @notice Gets the latest round ID for a given feed from the dataFeedStore
  /// @param id The ID of the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The latest round ID
  function latestRound(
    uint256 id,
    address dataFeedStore
  ) internal view returns (uint256) {
    return
      uint256(
        // 1st byte is function selector
        // after that are 16 bytes of the feed id
        _callDataFeed(dataFeedStore, (uint256(0x81) << 248) | id)
      );
  }

  /// @notice Gets the latest round data for a given feed from the dataFeedStore
  /// @dev Using assembly achieves lower gas costs
  /// @param id The ID of the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The latest round ID
  /// @return answer The latest stored value after being decoded
  /// @return startedAt The timestamp when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
  function latestRoundData(
    uint256 id,
    address dataFeedStore
  )
    internal
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256, uint80)
  {
    bytes32 returnData;

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
          id
        )
      )

      // call dataFeedStore with selector and store return value (64 bytes) at memory location ptr
      let success := staticcall(gas(), dataFeedStore, 0x00, 17, ptr, 64)

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      // load return value from memory at location ptr
      // roundId is stored in the first 32 bytes of the returned 64 bytes
      roundId := mload(ptr)

      // value is stored in the second 32 bytes of the returned 64 bytes
      returnData := mload(add(ptr, 32))
    }

    (answer, startedAt) = _decodeData(returnData);

    return (roundId, answer, startedAt, startedAt, roundId);
  }

  /// @notice Calls the dataFeedStore with the given data
  /// @dev Using assembly achieves lower gas costs
  /// Used as a call() function to dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param selector The data to call the dataFeedStore with
  /// @return returnData The return value from the dataFeedStore
  function _callDataFeed(
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
        19, // size of data to call - usually it is 17b but for _getRoundData it is 19b because of the 2 bytes of the roundId
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

  /// @notice Decodes the return data from the dataFeedStore
  /// @param data The data to decode
  /// @return answer The value stored for the feed at the given round ID
  /// @return timestamp The timestamp when the value was stored
  function _decodeData(bytes32 data) internal pure returns (int256, uint256) {
    return (
      int256(uint256(uint192(bytes24(data)))),
      uint64(uint256(data)) / 1000 // timestamp is stored in milliseconds
    );
  }

  /// @notice Shifts the feed id to the left by 120 bits
  /// @dev This is used in the constructor to save gas when calling the dataFeedStore
  /// The dataFeedStore expects the feed id to be positioned in the calldata in a 16 bytes value starting from the 2nd byte
  /// @param id The feed id to shift
  function shiftId(uint256 id) internal pure returns (uint256) {
    return id << 120;
  }
}
