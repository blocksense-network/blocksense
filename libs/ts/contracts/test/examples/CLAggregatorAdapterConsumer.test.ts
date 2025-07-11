import { artifacts, ethers, viem } from 'hardhat';
import { Contract } from 'ethers';
import { expect } from 'chai';
type EthersContractParams = ConstructorParameters<typeof Contract>;

import { CLAggregatorAdapterConsumer } from '@blocksense/contracts/typechain';
import { isObject } from '@blocksense/base-utils/type-level';

import * as utils from './utils/clAggregatorAdapterConsumer';
import { deployContract } from '../experiments/utils/helpers/common';
import {
  CLAdapterWrapper,
  UpgradeableProxyADFSWrapper,
} from '../utils/wrappers';
import { encodeDataAndTimestamp } from '../utils/helpers/common';
import { CLAggregatorAdapterConsumer as CLAggregatorAdapterConsumerViem } from '../../lib/viem/CLAggregatorAdapter';

describe('Example: CLAggregatorAdapterConsumer', function () {
  let clAggregatorAdapter: CLAdapterWrapper;
  let clAggregatorAdapterConsumer: CLAggregatorAdapterConsumer;
  let clAggregatorAdapterViem: CLAggregatorAdapterConsumerViem;

  beforeEach(async function () {
    const admin = (await ethers.getSigners())[9];
    const sequencer = (await ethers.getSigners())[10];
    const accessControlAdmin = (await ethers.getSigners())[5];

    const proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(admin, accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );

    clAggregatorAdapter = new CLAdapterWrapper();
    await clAggregatorAdapter.init('ETH/USD', 8, 3, proxy);

    const value = encodeDataAndTimestamp(1234, Date.now());
    await clAggregatorAdapter.setFeed(sequencer, value, 1n);

    clAggregatorAdapterConsumer =
      await deployContract<CLAggregatorAdapterConsumer>(
        'CLAggregatorAdapterConsumer',
        clAggregatorAdapter.contract.target,
      );

    const viemPublicClient = await viem.getPublicClient();
    clAggregatorAdapterViem = new CLAggregatorAdapterConsumerViem(
      clAggregatorAdapter.contract.target as `0x${string}`,
      viemPublicClient,
    );
  });

  type Functions = typeof utils;
  type FunctionName = keyof Functions;
  type FunctionParameters<F extends FunctionName> =
    Parameters<Functions[F]> extends [EthersContractParams, ...infer Rest]
      ? Rest
      : never;

  (
    [
      { title: 'get decimals', fnName: 'getDecimals' },
      { title: 'get description', fnName: 'getDescription' },
      { title: 'get latest answer', fnName: 'getLatestAnswer' },
      { title: 'get latest round', fnName: 'getLatestRound' },
      { title: 'get latest round data', fnName: 'getLatestRoundData' },
    ] satisfies { title: string; fnName: FunctionName }[]
  ).forEach(({ title, fnName }) => {
    it('Should ' + title, async function () {
      await getAndCompareData(fnName, []);
    });
  });

  it('Should get round data', async function () {
    await getAndCompareData('getRoundData', [1]);
  });

  const getAndCompareData = async <F extends FunctionName>(
    functionName: F,
    data: FunctionParameters<F>,
  ) => {
    const contractData = await clAggregatorAdapterConsumer.getFunction(
      functionName,
    )(...data);
    const viemContractData = await (
      clAggregatorAdapterViem[functionName] as (...args: any[]) => any
    )(...data);

    const config: EthersContractParams = [
      clAggregatorAdapter.contract.target,
      (await artifacts.readArtifact('CLAggregatorAdapter')).abi,
      clAggregatorAdapter.contract.runner!,
    ];

    const func = utils[functionName] as FunctionParameters<F> extends []
      ? (config: EthersContractParams) => Promise<any>
      : FunctionParameters<F> extends [unknown, ...unknown[]]
        ? (
            config: EthersContractParams,
            ...args: FunctionParameters<F>
          ) => Promise<any>
        : never;

    const utilData = await func(config, ...data);

    expect(contractData).to.deep.equal(utilData);
    expect(
      isObject(viemContractData)
        ? Object.values(viemContractData)
        : viemContractData,
    ).to.deep.equal(utilData);
  };
});
