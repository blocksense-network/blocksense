// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from '../interfaces/IChainlinkAggregator.sol';

// ChainlinkProxy calls UpgadeableProxy which calls HistoricDataFeedStoreV1
contract ChainlinkProxyV1 is IChainlinkAggregator {
  uint8 public immutable override decimals;
  uint32 internal immutable key;
  address internal immutable dataFeedStore;

  string public override description;

  constructor(
    string memory _description,
    uint8 _decimals,
    uint32 _key,
    address _dataFeedStore
  ) {
    description = _description;
    decimals = _decimals;
    key = _key;
    dataFeedStore = _dataFeedStore;
  }

  function latestAnswer() external view override returns (int256) {
    return
      int256(
        uint256(
          uint192(bytes24(_callDataFeed(abi.encodePacked(0x80000000 | key))))
        )
      );
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

  function getRoundData(
    uint80 _roundId
  )
    external
    view
    override
    returns (uint80, int256 answer, uint256 startedAt, uint256, uint80)
  {
    (answer, startedAt) = _decodeData(
      _callDataFeed(abi.encodeWithSelector(bytes4(0x20000000 | key), _roundId))
    );

    return (_roundId, answer, startedAt, startedAt, _roundId);
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

  function _decodeData(bytes32 data) internal pure returns (int256, uint256) {
    return (
      int256(uint256(uint192(bytes24(data)))),
      uint256(uint64(uint256(data)))
    );
  }
}
