// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IChainlinkAggregator} from '../interfaces/IChainlinkAggregator.sol';
import {IFeedRegistry} from '../interfaces/IChainlinkFeedRegistry.sol';

contract FeedRegistryV2 is IFeedRegistry {
  struct Feed {
    address dataFeedStore;
    uint32 key;
  }

  address public immutable owner;
  mapping(address => mapping(address => IChainlinkAggregator))
    internal registry;
  mapping(address => mapping(address => Feed)) internal dataFeedStore;

  error OnlyOwner();

  constructor(address _owner) {
    owner = _owner;
  }

  function decimals(
    address base,
    address quote
  ) external view override returns (uint8) {
    return registry[base][quote].decimals();
  }

  function description(
    address base,
    address quote
  ) external view override returns (string memory) {
    return registry[base][quote].description();
  }

  function latestAnswer(
    address base,
    address quote
  ) external view override returns (int256) {
    Feed memory feed = dataFeedStore[base][quote];
    return
      int256(
        uint256(
          uint192(
            bytes24(
              _callDataFeed(
                feed.dataFeedStore,
                abi.encodePacked(0x80000000 | feed.key)
              )
            )
          )
        )
      );
  }

  function latestRound(
    address base,
    address quote
  ) external view override returns (uint256 roundId) {
    Feed memory feed = dataFeedStore[base][quote];
    roundId = uint256(
      _callDataFeed(feed.dataFeedStore, abi.encodePacked(0x40000000 | feed.key))
    );
  }

  function getRoundData(
    address base,
    address quote,
    uint80 _roundId
  )
    external
    view
    override
    returns (uint80, int256 answer, uint256 startedAt, uint256, uint80)
  {
    Feed memory feed = dataFeedStore[base][quote];
    (answer, startedAt) = _decodeData(
      _callDataFeed(
        feed.dataFeedStore,
        abi.encodeWithSelector(bytes4(0x20000000 | feed.key), _roundId)
      )
    );

    return (_roundId, answer, startedAt, startedAt, _roundId);
  }

  function latestRoundData(
    address base,
    address quote
  )
    external
    view
    override
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256, uint80)
  {
    Feed memory feed = dataFeedStore[base][quote];
    roundId = uint80(
      uint256(
        (
          _callDataFeed(
            feed.dataFeedStore,
            abi.encodePacked(0x40000000 | feed.key)
          )
        )
      )
    );
    (answer, startedAt) = _decodeData(
      _callDataFeed(
        feed.dataFeedStore,
        abi.encodeWithSelector(bytes4(0x20000000 | feed.key), roundId)
      )
    );

    return (roundId, answer, startedAt, startedAt, roundId);
  }

  function getFeed(
    address base,
    address quote
  ) external view override returns (IChainlinkAggregator) {
    return registry[base][quote];
  }

  function setFeed(address base, address quote, address feed) external {
    if (msg.sender != owner) {
      revert OnlyOwner();
    }

    registry[base][quote] = IChainlinkAggregator(feed);
    dataFeedStore[base][quote] = Feed(
      IChainlinkAggregator(feed).dataFeedStore(),
      IChainlinkAggregator(feed).key()
    );
  }

  function _callDataFeed(
    address _dataFeedStore,
    bytes memory data
  ) internal view returns (bytes32 returnData) {
    // using assembly staticcall costs less gas than using a view function
    assembly {
      // get free memory pointer
      let ptr := mload(0x40)
      // call dataFeed with data and store return value at memory location ptr
      let success := staticcall(
        gas(),
        _dataFeedStore,
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
