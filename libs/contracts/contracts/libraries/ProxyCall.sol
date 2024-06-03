// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

library ProxyCall {
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

  function _latestRound(
    uint32 key,
    address dataFeedStore
  ) internal view returns (uint256 roundId) {
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)

      // store selector in memory at location 0
      mstore(0x00, shl(224, or(0x40000000, key)))

      // call dataFeedStore with selector 0xc0000000 | key and store return value at memory location ptr
      let success := staticcall(gas(), dataFeedStore, 0x00, 4, ptr, 64)
      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      roundId := mload(add(ptr, 32))
    }
  }

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
      // call dataFeedStore with selector 0xc0000000 | key and store return value at memory location ptr
      let success := staticcall(gas(), dataFeedStore, 0x00, 4, ptr, 64)
      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }
      // assign return value to returnData
      returnData := mload(ptr)
      roundId := mload(add(ptr, 32))
    }

    (answer, startedAt) = _decodeData(returnData);

    return (roundId, answer, startedAt, startedAt, roundId);
  }

  function _callDataFeed(
    address dataFeedStore,
    bytes memory data
  ) internal view returns (bytes32 returnData) {
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)
      // call dataFeedStore with data and store return value at memory location ptr
      let success := staticcall(
        gas(),
        dataFeedStore,
        add(data, 32),
        mload(data),
        ptr,
        32
      )
      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }
      // assign return value to returnData
      returnData := mload(ptr)
    }
  }

  function _decodeData(bytes32 data) internal pure returns (int256, uint256) {
    return (int256(uint256(uint192(bytes24(data)))), uint64(uint256(data)));
  }
}
