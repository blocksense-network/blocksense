// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProxyCall
/// @notice Library for calling dataFeedStore functions
/// @dev Contains utility functions for calling gas efficiently dataFeedStore functions and decoding return data
library ProxyCall {
  /// @notice Gets the latest answer from the dataFeedStore
  /// @param key The key ID for the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return answer The latest stored value after being decoded
  function _latestAnswer(
    uint32 key,
    address dataFeedStore
  ) internal view returns (int256) {
    return
      int256(
        uint256(
          uint192(
            bytes24(
              _callDataFeed(dataFeedStore, abi.encodePacked(0x80000000 | key))
            )
          )
        )
      );
  }

  /// @notice Gets the round data from the dataFeedStore
  /// @param _roundId The round ID to retrieve data for
  /// @param key The key ID for the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The round ID
  /// @return answer The value stored for the feed at the given round ID
  /// @return startedAt The timestamp when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
  function _getRoundData(
    uint80 _roundId,
    uint32 key,
    address dataFeedStore
  )
    internal
    view
    returns (uint80, int256 answer, uint256 startedAt, uint256, uint80)
  {
    (answer, startedAt) = _decodeData(
      _callDataFeed(
        dataFeedStore,
        abi.encodeWithSelector(bytes4(0x20000000 | key), _roundId)
      )
    );

    return (_roundId, answer, startedAt, startedAt, _roundId);
  }

  /// @notice Gets the latest round ID for a given feed from the dataFeedStore
  /// @dev Using assembly achieves lower gas costs
  /// @param key The key ID for the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The latest round ID
  function _latestRound(
    uint32 key,
    address dataFeedStore
  ) internal view returns (uint256 roundId) {
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)

      // store selector in memory at location 0
      mstore(0, shl(224, or(0x40000000, key)))

      // call dataFeedStore with selector 0xc0000000 | key (4 bytes) and store return value (64 bytes) at memory location ptr
      let success := staticcall(gas(), dataFeedStore, 0, 4, ptr, 64)

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      // load return value from memory at location ptr
      // roundId is stored in the second 32 bytes of the return 64 bytes
      roundId := mload(add(ptr, 32))
    }
  }

  /// @notice Gets the latest round data for a given feed from the dataFeedStore
  /// @dev Using assembly achieves lower gas costs
  /// @param key The key ID for the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The latest round ID
  /// @return answer The latest stored value after being decoded
  /// @return startedAt The timestamp when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
  function _latestRoundData(
    uint32 key,
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
      mstore(0x00, shl(224, or(0xc0000000, key)))

      // call dataFeedStore with selector 0xc0000000 | key (4 bytes) and store return value (64 bytes) at memory location ptr
      let success := staticcall(gas(), dataFeedStore, 0x00, 4, ptr, 64)

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      // assign return value to returnData
      returnData := mload(ptr)

      // load return value from memory at location ptr
      // roundId is stored in the second 32 bytes of the return 64 bytes
      roundId := mload(add(ptr, 32))
    }

    (answer, startedAt) = _decodeData(returnData);

    return (roundId, answer, startedAt, startedAt, roundId);
  }

  /// @notice Calls the dataFeedStore with the given data
  /// @dev Using assembly achieves lower gas costs
  /// Used as a call() function to dataFeedStore
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @param data The data to call the dataFeedStore with
  /// @return returnData The return value from the dataFeedStore
  function _callDataFeed(
    address dataFeedStore,
    bytes memory data
  ) internal view returns (bytes32 returnData) {
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)

      // call dataFeedStore with data and store return value (32 bytes) at memory location ptr
      let success := staticcall(
        gas(), // gas remaining
        dataFeedStore, // address to call
        add(data, 32), // location of data to call (skip first 32 bytes of data which is the length of data)
        mload(data), // size of data to call
        ptr, // where to store the return data
        32 // how much data to store
      )

      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      // assign loaded return value at memory location ptr to returnData
      returnData := mload(ptr)
    }
  }

  /// @notice Decodes the return data from the dataFeedStore
  /// @param data The data to decode
  /// @return answer The value stored for the feed at the given round ID
  /// @return timestamp The timestamp when the value was stored
  function _decodeData(bytes32 data) internal pure returns (int256, uint256) {
    return (int256(uint256(uint192(bytes24(data)))), uint64(uint256(data)));
  }
}
