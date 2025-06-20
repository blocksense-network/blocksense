import { ethers } from 'hardhat';
import { expect } from 'chai';

import { CLFeedRegistryAdapterConsumer } from '@blocksense/contracts/typechain';
import { TOKENS, deployContract } from '../utils/helpers/common';
import {
  CLRegistryBaseWrapper,
  CLV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from '../utils/wrappers';

const data = [
  {
    base: TOKENS.ETH,
    quote: TOKENS.USD,
    description: 'ETH/USD',
    decimals: 8,
    key: 3,
  },
  {
    base: TOKENS.BTC,
    quote: TOKENS.USD,
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

  it('Should compare results from adapter with those from adapter consumer', async function () {
    for (const { base, quote, key, description, decimals } of data) {
      await feedRegistry.checkFeed(
        base,
        quote,
        await clFeedRegistryAdapterConsumer.getFeed(base, quote),
      );

      await feedRegistry.checkDecimals(
        base,
        quote,
        Number(await clFeedRegistryAdapterConsumer.getDecimals(base, quote)),
      );
      await feedRegistry.checkDecimals(base, quote, decimals);

      await feedRegistry.checkDescription(
        base,
        quote,
        await clFeedRegistryAdapterConsumer.getDescription(base, quote),
      );
      await feedRegistry.checkDescription(base, quote, description);

      const answer = await clFeedRegistryAdapterConsumer.getLatestAnswer(
        base,
        quote,
      );
      await feedRegistry.checkLatestAnswer(base, quote, answer);

      expect(
        await clFeedRegistryAdapterConsumer.getLatestRound(base, quote),
      ).to.deep.equal(1n);

      const roundData = await clFeedRegistryAdapterConsumer.getRoundData(
        base,
        quote,
        1n,
      );
      expect(roundData).to.deep.equal([
        /* roundId_: */ 1n,
        /* answer_: */ answer,
        /* startedAt_: */ roundData.startedAt,
        /* updatedAt_: */ roundData.startedAt,
        /* answeredInRound_: */ 1n,
      ]);
      await feedRegistry.checkLatestRoundData(base, quote, {
        answer: answer,
        roundId: 1n,
        startedAt: Number(roundData.startedAt),
      });
    }
  });
});
