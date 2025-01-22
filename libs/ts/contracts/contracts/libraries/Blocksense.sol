// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Blocksense
/// @notice Library for calling dataFeedStore functions
/// @dev Contains utility functions for calling gas efficiently dataFeedStore functions and decoding return data
library Blocksense {
  /// @notice Gets the latest answer from the dataFeedStore
  /// @param id The key ID for the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return answer The latest stored value after being decoded
  function _latestAnswer(
    uint256 id,
    address dataFeedStore
  ) internal view returns (int256) {
    return
      int256(
        uint256(
          uint192(
            bytes24(
              // 1st 2 bytes are function selector and stride (which is always 0 for CL adapters)
              // after that are 15 bytes of the feed id
              _callDataFeed(dataFeedStore, (uint256(0x82) << 248) | (id << 120))
            )
          )
        )
      );
  }

  /// @notice Gets the round data from the dataFeedStore
  /// @param _roundId The round ID to retrieve data for
  /// @param id The key ID for the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The round ID
  /// @return answer The value stored for the feed at the given round ID
  /// @return startedAt The timestamp when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
  function _getRoundData(
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
        // 1st 2 bytes are function selector and stride (which is always 0 for CL adapters)
        // after that are 15 bytes of the feed id
        // after the feed id are 2 bytes of the round id
        (uint256(0x84) << 248) | (id << 120) | (uint256(_roundId) << 104)
      )
    );
    return (_roundId, answer, startedAt, startedAt, _roundId);
  }

  /// @notice Gets the latest round ID for a given feed from the dataFeedStore
  /// @dev Using assembly achieves lower gas costs
  /// @param id The key ID for the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The latest round ID
  function _latestRound(
    uint256 id,
    address dataFeedStore
  ) internal view returns (uint256) {
    return
      uint256(
        // 1st 2 bytes are function selector and stride (which is always 0 for CL adapters)
        // after that are 15 bytes of the feed id
        _callDataFeed(dataFeedStore, (uint256(0x81) << 248) | (id << 120))
      );
  }

  /// @notice Gets the latest round data for a given feed from the dataFeedStore
  /// @dev Using assembly achieves lower gas costs
  /// @param id The key ID for the feed
  /// @param dataFeedStore The address of the dataFeedStore contract
  /// @return roundId The latest round ID
  /// @return answer The latest stored value after being decoded
  /// @return startedAt The timestamp when the value was stored
  /// @return updatedAt Same as startedAt
  /// @return answeredInRound Same as roundId
  function _latestRoundData(
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
      // 1st 2 bytes are function selector and stride (which is always 0 for CL adapters)
      // after that are 15 bytes of the feed id
      mstore(
        0x00,
        or(
          0x8300000000000000000000000000000000000000000000000000000000000000,
          shl(120, id)
        )
      )

      // call dataFeedStore with selector and store return value (64 bytes) at memory location ptr
      let success := staticcall(gas(), dataFeedStore, 0x00, 19, ptr, 64)

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
      // get free memory pointer
      let ptr := mload(0x40)

      // store selector in memory at location 0
      mstore(0x00, selector)

      // call dataFeedStore with data and store return value (32 bytes) at memory location ptr
      let success := staticcall(
        gas(), // gas remaining
        dataFeedStore, // address to call
        0x00, // location of data to call
        21, // size of data to call - usually it is 19b but for _getRoundData it is 21b because of the 2 bytes of the roundId
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
