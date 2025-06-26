import { artifacts, ethers } from 'hardhat';
import { Contract } from 'ethers';
type EthersContractParams = ConstructorParameters<typeof Contract>;
import { CLFeedRegistryAdapterConsumer } from '@blocksense/contracts/typechain';
import { TOKENS, deployContract } from '../utils/helpers/common';
import {
  CLRegistryBaseWrapper,
  CLV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from '../utils/wrappers';
import * as utils from '../../examples/utils/clFeedRegistryAdapterConsumer';
import { expect } from 'chai';

const data = [
  {
    description: 'ETH/USD',
    decimals: 8,
    key: 3,
  },
  {
    description: 'BTC/USD',
    decimals: 6,
    key: 132,
  },
];

describe('[Experiments] Example: CLFeedRegistryAdapterConsumer', function () {
  let feedRegistry: CLRegistryBaseWrapper;
  let clFeedRegistryAdapterConsumer: CLFeedRegistryAdapterConsumer;

  beforeEach(async function () {
    let aggregators = [];

    const admin = (await ethers.getSigners())[5];

    const proxyV2 = new UpgradeableProxyHistoricalDataFeedStoreV2Wrapper();
    await proxyV2.init(admin);

    for (const d of data) {
      aggregators.push(new CLV2Wrapper());

      await aggregators[aggregators.length - 1].init(
        d.description,
        d.decimals,
        d.key,
        proxyV2,
      );

      const value = ethers.encodeBytes32String(d.decimals.toString());
      await aggregators[aggregators.length - 1].setFeed(value);
    }

    const owner = (await ethers.getSigners())[2];

    feedRegistry = new CLRegistryBaseWrapper('CLRegistryV2', proxyV2.contract);
    await feedRegistry.init(owner);

    await feedRegistry.setFeeds([
      {
        base: TOKENS.ETH,
        quote: TOKENS.USD,
        feed: aggregators[0],
      },
      {
        base: TOKENS.BTC,
        quote: TOKENS.USD,
        feed: aggregators[1],
      },
    ]);

    clFeedRegistryAdapterConsumer =
      await deployContract<CLFeedRegistryAdapterConsumer>(
        'CLFeedRegistryAdapterConsumer',
        feedRegistry.contract.target,
      );
  });

  type Functions = typeof utils;
  type FunctionName = keyof Functions;
  type FunctionParameters<F extends FunctionName> =
    Parameters<Functions[F]> extends [EthersContractParams, ...infer Rest]
      ? Rest extends [base: string, quote: string, ...unknown[]]
        ? Rest
        : never
      : never;

  (
    [
      { title: 'get decimals', fnName: 'getDecimals' },
      { title: 'get description', fnName: 'getDescription' },
      { title: 'get latest answer', fnName: 'getLatestAnswer' },
      { title: 'get latest round', fnName: 'getLatestRound' },
      { title: 'get latest round data', fnName: 'getLatestRoundData' },
      { title: 'get feed', fnName: 'getFeed' },
    ] satisfies { title: string; fnName: FunctionName }[]
  ).forEach(({ title, fnName }) => {
    it('Should ' + title, async function () {
      await getAndCompareData(
        [
          [TOKENS.ETH, TOKENS.USD],
          [TOKENS.BTC, TOKENS.USD],
        ],
        fnName,
      );
    });
  });

  it('Should get round data', async function () {
    await getAndCompareData(
      [
        [TOKENS.ETH, TOKENS.USD, 1],
        [TOKENS.BTC, TOKENS.USD, 1],
      ],
      'getRoundData',
    );
  });

  async function getAndCompareData<F extends FunctionName>(
    data: [FunctionParameters<F>, FunctionParameters<F>],
    functionName: F,
  ) {
    const contractData1 = await clFeedRegistryAdapterConsumer.getFunction(
      functionName,
    )(...data[0]);
    const contractData2 = await clFeedRegistryAdapterConsumer.getFunction(
      functionName,
    )(...data[1]);

    const config: EthersContractParams = [
      feedRegistry.contract.target,
      (await artifacts.readArtifact('CLFeedRegistryAdapterExp')).abi,
      feedRegistry.contract.runner!,
    ];

    const func = utils[functionName] as (
      config: EthersContractParams,
      ...args: FunctionParameters<F>
    ) => Promise<any>;

    const utilData1 = await func(config, ...data[0]);
    const utilData2 = await func(config, ...data[1]);

    expect(contractData1).to.deep.equal(utilData1);
    expect(contractData2).to.deep.equal(utilData2);
  }
});
