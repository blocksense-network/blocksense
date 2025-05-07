import { artifacts, ethers } from 'hardhat';
import { CLFeedRegistryAdapterConsumer } from '../../../typechain';
import { TOKENS, deployContract } from '../utils/helpers/common';
import {
  CLRegistryBaseWrapper,
  CLV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from '../utils/wrappers';
import * as utils from '../../examples/utils/clFeedRegistryAdapterConsumer';
import { expect } from 'chai';
import {
  functions,
  RegistryConfig,
} from '../../examples/utils/clFeedRegistryAdapterConsumer';

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

  [
    { title: 'get decimals', fnName: 'getDecimals' } as const,
    { title: 'get description', fnName: 'getDescription' } as const,
    { title: 'get latest answer', fnName: 'getLatestAnswer' } as const,
    { title: 'get latest round', fnName: 'getLatestRound' } as const,
    { title: 'get latest round data', fnName: 'getLatestRoundData' } as const,
    { title: 'get feed', fnName: 'getFeed' } as const,
  ].forEach(data => {
    it('Should ' + data.title, async function () {
      await getAndCompareData(data.fnName, [
        [TOKENS.ETH, TOKENS.USD],
        [TOKENS.BTC, TOKENS.USD],
      ]);
    });
  });

  it('Should get round data', async function () {
    await getAndCompareData('getRoundData', [
      [TOKENS.ETH, TOKENS.USD, 1],
      [TOKENS.BTC, TOKENS.USD, 1],
    ]);
  });

  type Functions = typeof functions;
  type FunctionName = keyof Functions;
  type FunctionParameters<F extends FunctionName> =
    Parameters<Functions[F]> extends [RegistryConfig, ...infer Rest]
      ? Rest
      : never;

  async function getAndCompareData<F extends FunctionName>(
    functionName: F,
    data: FunctionParameters<F>[],
  ) {
    const contractData1 = await clFeedRegistryAdapterConsumer.getFunction(
      functionName,
    )(...data[0]);
    const contractData2 = await clFeedRegistryAdapterConsumer.getFunction(
      functionName,
    )(...data[1]);

    const config = {
      address: feedRegistry.contract.target,
      abiJson: (await artifacts.readArtifact('CLFeedRegistryAdapterExp')).abi,
      provider: feedRegistry.contract.runner!,
    };
    const utilData1 = await functions[functionName](
      config,
      ...(data[0] as any),
    );
    const utilData2 = await functions[functionName](
      config,
      ...(data[1] as any),
    );

    expect(contractData1).to.deep.equal(utilData1);
    expect(contractData2).to.deep.equal(utilData2);
  }
});
