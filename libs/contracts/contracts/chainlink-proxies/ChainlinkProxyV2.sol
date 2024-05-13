// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ChainlinkProxy} from './ChainlinkProxy.sol';

// ChainlinkProxy calls UpgadeableProxy which calls HistoricDataFeedStoreV2
contract ChainlinkProxyV2 is ChainlinkProxy {
  constructor(
    string memory _description,
    uint8 _decimals,
    uint32 _key,
    address _dataFeedStore
  ) ChainlinkProxy(_description, _decimals, _key, _dataFeedStore) {}

  function latestRound() external view override returns (uint256) {
    return uint256(_callDataFeed(abi.encodePacked(0x40000000 | key)));
  }

  function latestRoundData()
    external
    view
    override
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256, uint80)
  {
    roundId = uint80(
      uint256((_callDataFeed(abi.encodePacked(0x40000000 | key))))
    );
    (answer, startedAt) = _decodeData(
      _callDataFeed(abi.encodeWithSelector(bytes4(0x20000000 | key), roundId))
    );

    return (roundId, answer, startedAt, startedAt, roundId);
  }
}
