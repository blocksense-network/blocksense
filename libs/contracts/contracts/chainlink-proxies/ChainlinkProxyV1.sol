// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ChainlinkProxy} from './ChainlinkProxy.sol';
// ChainlinkProxy calls UpgadeableProxy which calls HistoricDataFeedStoreV1
contract ChainlinkProxyV1 is ChainlinkProxy {
  constructor(
    string memory _description,
    uint8 _decimals,
    uint32 _key,
    address _dataFeedStore
  ) ChainlinkProxy(_description, _decimals, _key, _dataFeedStore) {}

  function latestRound() external view override returns (uint256 roundId) {
    address dataFeed = dataFeedStore;
    uint32 _key = key;

    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)

      // store selector in memory at location 0
      mstore(0x00, shl(224, or(0x40000000, _key)))

      // call dataFeed with selector 0xc0000000 | key and store return value at memory location ptr
      let success := staticcall(gas(), dataFeed, 0x00, 4, ptr, 64)
      // revert if call failed
      if iszero(success) {
        revert(0, 0)
      }

      roundId := mload(add(ptr, 32))
    }
  }

  function latestRoundData()
    external
    view
    override
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256, uint80)
  {
    address dataFeed = dataFeedStore;
    bytes32 returnData;
    uint32 _key = key;

    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)
      // store selector in memory at location 0
      mstore(0x00, shl(224, or(0xc0000000, _key)))
      // call dataFeed with selector 0xc0000000 | key and store return value at memory location ptr
      let success := staticcall(gas(), dataFeed, 0x00, 4, ptr, 64)
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
}
