import { artifacts, ethers } from 'hardhat';
import { CLFeedRegistryAdapterConsumer } from '../../typechain';
import { deployContract, TOKENS } from '../experiments/utils/helpers/common';
import * as utils from './utils/clFeedRegistryAdapterConsumer';
import { expect } from 'chai';
import {
  CLAdapterWrapper,
  CLRegistryBaseWrapper,
  UpgradeableProxyADFSWrapper,
} from '../utils/wrappers';
import { encodeDataAndTimestamp } from '../utils/helpers/common';

const aggregatorData = [
  {
    description: 'ETH/USD',
    decimals: 8,
    key: 3,
    base: TOKENS.ETH,
    quote: TOKENS.USD,
  },
  {
    description: 'BTC/USD',
    decimals: 6,
    key: 132,
    base: TOKENS.BTC,
    quote: TOKENS.USD,
  },
];

describe('Example: CLFeedRegistryAdapterConsumer', function () {
  let feedRegistry: CLRegistryBaseWrapper;
  let clFeedRegistryAdapterConsumer: CLFeedRegistryAdapterConsumer;

  beforeEach(async function () {
    let aggregators = [];

    const admin = (await ethers.getSigners())[9];
    const sequencer = (await ethers.getSigners())[10];
    const accessControlAdmin = (await ethers.getSigners())[5];
    const registryOwner = (await ethers.getSigners())[11];

    const proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(admin, accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );

    for (const data of aggregatorData) {
      const newAdapter = new CLAdapterWrapper();
      await newAdapter.init(data.description, data.decimals, data.key, proxy);
      aggregators.push(newAdapter);

      const value = encodeDataAndTimestamp(data.key * 1000, Date.now());
      await newAdapter.setFeed(sequencer, value, 1n);
    }

    feedRegistry = new CLRegistryBaseWrapper('CLRegistryV2', proxy.contract);
    await feedRegistry.init(registryOwner);

    await feedRegistry.setFeeds(
      aggregatorData.map((d, i) => {
        return {
          base: d.base,
          quote: d.quote,
          feed: aggregators[i],
        };
      }),
    );

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
