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
    { title: 'get decimals', fnName: 'getDecimals' },
    { title: 'get description', fnName: 'getDescription' },
    { title: 'get latest answer', fnName: 'getLatestAnswer' },
    { title: 'get latest round', fnName: 'getLatestRound' },
    { title: 'get latest round data', fnName: 'getLatestRoundData' },
    { title: 'get feed', fnName: 'getFeed' },
  ].forEach(data => {
    it('Should ' + data.title, async function () {
      await getAndCompareData(
        [
          [TOKENS.ETH, TOKENS.USD],
          [TOKENS.BTC, TOKENS.USD],
        ],
        data.fnName as keyof typeof utils,
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

  const getAndCompareData = async (
    data: any[],
    functionName: keyof typeof utils,
  ) => {
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
    const utilData1 = await utils[functionName](config, ...data[0]);
    const utilData2 = await utils[functionName](config, ...data[1]);

    expect(contractData1).to.deep.equal(utilData1);
    expect(contractData2).to.deep.equal(utilData2);
  };
});
