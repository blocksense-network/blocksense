import { Web3 } from 'web3';
import { describe, expect, test } from 'vitest';

import { getEnvString } from '@blocksense/base-utils/env';

import { decodeDeploymentConfig } from '@blocksense/config-types/evm-contracts-deployment';

import FEED_REGISTRY_ABI from '../artifacts/built-contracts/contracts/chainlink-proxies/registries/FeedRegistry.sol/FeedRegistry.json';
import HDF_STORE_ABI from '../artifacts/built-contracts/contracts/HistoricDataFeedStoreV2.sol/HistoricDataFeedStoreV2.json';
import CHAINLINK_PROXY_ABI from '../artifacts/built-contracts/contracts/chainlink-proxies/ChainlinkProxy.sol/ChainlinkProxy.json';
import DEPLOYMENT_CONFIG from '../artifacts/evm_contracts_deployment_v1.json';
import { assert } from 'console';
import { cons } from 'effect/List';

const RPC_URL_LOCAL = 'http://127.0.0.1:8545';

describe('Check On-Chain data', async () => {
  const web3 = new Web3(RPC_URL_LOCAL);

  const deploymentConfig = decodeDeploymentConfig(DEPLOYMENT_CONFIG);
  const chainID = 'ethereum-sepolia';
  console.log('chainID', chainID);

  const feedRegistryAddress =
    deploymentConfig[chainID].contracts.coreContracts.FeedRegistry.address;
  const feedRegistryContract = new web3.eth.Contract(
    FEED_REGISTRY_ABI.abi,
    feedRegistryAddress,
  );

  const chainlinkProxyDeploymentData =
    deploymentConfig[chainID].contracts.ChainlinkProxy[0];

  const chainlinkProxyAddress = chainlinkProxyDeploymentData.address;
  const chainlinkProxyContract = new web3.eth.Contract(
    CHAINLINK_PROXY_ABI.abi,
    chainlinkProxyAddress,
  );

  const baseAddress = chainlinkProxyDeploymentData.base;
  const quoteAddress = chainlinkProxyDeploymentData.quote;

  // test('Check contract registration to Feed Registry', async () => {
  //   const feedRegistryContract = new web3.eth.Contract(
  //     FEED_REGISTRY_ABI.abi,
  //     feedRegistryAddress,
  //   );
  //   const chainlinkProxyAddressOnChain = await feedRegistryContract.methods[
  //     'getFeed'
  //   ](baseAddress, quoteAddress).call();

  //   expect(chainlinkProxyAddressOnChain).toBe(chainlinkProxyAddress);
  // });

  // test('Check On Chain written value', async () => {
  //   const expectedValue = '42000000000000000000000';
  //   const latestAnswerInChainlinkProxy =
  //     await chainlinkProxyContract.methods['latestAnswer']().call();

  //   const latestAnswerInFeedRegistry = await feedRegistryContract.methods[
  //     'latestAnswer'
  //   ](baseAddress, quoteAddress).call();

  //   expect(latestAnswerInChainlinkProxy).toBe(latestAnswerInFeedRegistry);
  //   expect(latestAnswerInChainlinkProxy).toBe(expectedValue);
  // });

  test('Check data on Historic Data Feed Store', async () => {
    const upgradeableProxyAddress =
      deploymentConfig[chainID].contracts.coreContracts.UpgradeableProxy
        .address;

    const key = 1000;
    const data =
      '0x' + ((0x80000000 | key) >>> 0).toString(16).padStart(8, '0');
    // const data =
    //   '0x' + ((key | 0x80000000) >>> 0).toString(16).padStart(8, '0');

    console.log('data', data);
    ``;
    const res = await web3.eth.call({
      to: upgradeableProxyAddress,
      data,
    });
    console.log('res', res);
    // const value = Number(res.slice(0, 50));
    // const timestamp = Number('0x' + res.slice(50, 66));
  });
});
