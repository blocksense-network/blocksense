// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import './Consumer.sol';

contract HistoricDataFeedConsumer is HistoricConsumer {
  constructor(address _dataFeedStore) HistoricConsumer(_dataFeedStore) {}

  function _getFeedById(
    uint32 key
  ) internal view override returns (TransmissionUtils.Data memory) {
    return decodeData(_callDataFeed(0x80000000 | key));
  }

  function _getLatestCounter(
    uint32 key
  ) internal view override returns (uint32 counter) {
    address dataFeed = dataFeedStore;
    assembly {
      let ptr := mload(0x40) // get free memory pointer
      mstore(0x00, shl(224, or(0x40000000, key)))
      let succcess := staticcall(gas(), dataFeed, 0x00, 4, ptr, 32)
      if iszero(succcess) {
        revert(0, 0)
      }
      counter := mload(ptr)
    }
  }

  function _getFeedAtCounter(
    uint32 key,
    uint32 counter
  ) internal view override returns (TransmissionUtils.Data memory) {
    (bool success, bytes memory returnData) = dataFeedStore.staticcall(
      abi.encodeWithSelector(bytes4(0x20000000 | key), counter)
    );

    if (!success) {
      revert GetFeedByIdFailed();
    }

    return decodeData(returnData);
  }

  function _callDataFeed(uint32 key) internal view returns (bytes memory) {
    (bool success, bytes memory returnData) = dataFeedStore.staticcall(
      abi.encodeWithSelector(bytes4(key))
    );

    if (!success) {
      revert GetFeedByIdFailed();
    }

    return returnData;
  }

  function decodeData(
    bytes memory data
  ) internal pure returns (TransmissionUtils.Data memory data_) {
    uint64 timestamp_;
    assembly {
      let cc := add(add(data, 32), 0x18)
      timestamp_ := shr(192, mload(cc))
    }

    data_.timestamp = timestamp_;
    data_.value = bytes24(data);
  }
}
