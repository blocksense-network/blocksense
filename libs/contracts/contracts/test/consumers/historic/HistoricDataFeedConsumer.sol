// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import './HistoricConsumer.sol';

abstract contract HistoricDataFeedConsumer is HistoricConsumer {
  constructor(address _dataFeedStore) HistoricConsumer(_dataFeedStore) {}

  function _getFeedById(
    uint32 key
  ) internal view override returns (Transmission memory) {
    return
      decodeTransmission(_callDataFeed(abi.encodePacked(0x80000000 | key)));
  }

  function _getFeedAtCounter(
    uint32 key,
    uint32 counter
  ) internal view override returns (Transmission memory) {
    return
      decodeTransmission(
        _callDataFeed(abi.encodeWithSelector(bytes4(0x20000000 | key), counter))
      );
  }

  function _callDataFeed(
    bytes memory data
  ) internal view returns (bytes32 returnData) {
    address dataFeed = dataFeedStore;

    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)
      // call dataFeed with data and store return value at memory location ptr
      let success := staticcall(
        gas(),
        dataFeed,
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

  function decodeTransmission(
    bytes32 data
  ) internal pure returns (Transmission memory data_) {
    data_.value = bytes24(data);
    data_.timestamp = uint64(uint256(data));
  }
}
