import { artifacts, ethers } from 'hardhat';
import { Contract } from 'ethers';
type EthersContractParams = ConstructorParameters<typeof Contract>;

import { CLAggregatorAdapterConsumer } from '@blocksense/contracts/typechain';
import { deployContract } from '../utils/helpers/common';
import {
  CLV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from '../utils/wrappers';
import * as utils from '../../examples/utils/clAggregatorAdapterConsumer';
import { expect } from 'chai';

describe('[Experiments] Example: CLAggregatorAdapterConsumer', function () {
  let clAggregatorAdapter: CLV2Wrapper;
  let clAggregatorAdapterConsumer: CLAggregatorAdapterConsumer;

  beforeEach(async function () {
    const admin = (await ethers.getSigners())[5];

    const proxy = new UpgradeableProxyHistoricalDataFeedStoreV2Wrapper();
    await proxy.init(admin);

    clAggregatorAdapter = new CLV2Wrapper();

    await clAggregatorAdapter.init('ETH/USD', 8, 3, proxy);

    const value = ethers.encodeBytes32String('1234');
    await clAggregatorAdapter.setFeed(value);

    clAggregatorAdapterConsumer =
      await deployContract<CLAggregatorAdapterConsumer>(
        'CLAggregatorAdapterConsumer',
        clAggregatorAdapter.contract.target,
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
      await getAndCompareData([], fnName);
    });
  });

  it('Should get round data', async function () {
    await getAndCompareData([1], 'getRoundData');
  });

  const getAndCompareData = async <F extends FunctionName>(
    data: FunctionParameters<F>,
    functionName: F,
  ) => {
    const contractData = await clAggregatorAdapterConsumer.getFunction(
      functionName,
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
  };
});
