// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ChainlinkProxy} from './ChainlinkProxy.sol';
import {ProxyCallV2} from '../libraries/ProxyCallV2.sol';

// ChainlinkProxy calls UpgadeableProxy which calls HistoricDataFeedStoreV2
contract ChainlinkProxyV2 is ChainlinkProxy {
  constructor(
    string memory _description,
    uint8 _decimals,
    uint32 _key,
    address _dataFeedStore
  ) ChainlinkProxy(_description, _decimals, _key, _dataFeedStore) {}

  function latestRound() external view override returns (uint256) {
    return ProxyCallV2._latestRound(key, dataFeedStore);
  }

  function latestRoundData()
    external
    view
    override
    returns (uint80, int256, uint256, uint256, uint80)
  {
    return ProxyCallV2._latestRoundData(key, dataFeedStore);
  }
}
