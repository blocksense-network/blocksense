import { Web3 } from 'web3';
import { describe, expect, test } from 'vitest';

import { getEnvString } from '@blocksense/base-utils/env';

import { decodeDeploymentConfig } from './types';

import FEED_REGISTRY_ABI from '../artifacts/built-contracts/contracts/chainlink-proxies/registries/FeedRegistry.sol/FeedRegistry.json';
import CHAINLINK_PROXY_ABI from '../artifacts/built-contracts/contracts/chainlink-proxies/ChainlinkProxy.sol/ChainlinkProxy.json';
import DEPLOYMENT_CONFIG from '../artifacts/deploymentV1.json';
import { assert } from 'console';

const RPC_URL_LOCAL = 'http://127.0.0.1:9944';

describe('Check On-Chain data', async () => {
  const web3 = new Web3(RPC_URL_LOCAL);

  const deploymentConfig = decodeDeploymentConfig(DEPLOYMENT_CONFIG);
  const chainID = Object.keys(deploymentConfig)[0];
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

  test('Check contract registration to Feed Registry', async () => {
    const feedRegistryContract = new web3.eth.Contract(
      FEED_REGISTRY_ABI.abi,
      feedRegistryAddress,
    );
    const chainlinkProxyAddressOnChain = await feedRegistryContract.methods[
      'getFeed'
    ](baseAddress, quoteAddress).call();

    expect(chainlinkProxyAddressOnChain).toBe(chainlinkProxyAddress);
  });

  test('Check On Chain written value', async () => {
    const expectedValue = '42000000000000000000000';
    const latestAnswerInChainlinkProxy =
      await chainlinkProxyContract.methods['latestAnswer']().call();

    const latestAnswerInFeedRegistry = await feedRegistryContract.methods[
      'latestAnswer'
    ](baseAddress, quoteAddress).call();

    expect(latestAnswerInChainlinkProxy).toBe(latestAnswerInFeedRegistry);
    expect(latestAnswerInChainlinkProxy).toBe(expectedValue);
  });
});
