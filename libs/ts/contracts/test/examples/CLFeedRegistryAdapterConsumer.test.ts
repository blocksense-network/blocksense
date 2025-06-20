import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';

import { CLFeedRegistryAdapterConsumer } from '@blocksense/contracts/typechain';
import { deployContract, TOKENS } from '../experiments/utils/helpers/common';
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
    id: 3,
    base: TOKENS.ETH,
    quote: TOKENS.USD,
  },
  {
    description: 'BTC/USD',
    decimals: 6,
    id: 132,
    base: TOKENS.BTC,
    quote: TOKENS.USD,
  },
];

describe('Example: CLFeedRegistryAdapterConsumer', function () {
  let feedRegistry: CLRegistryBaseWrapper;
  let clFeedRegistryAdapterConsumer: CLFeedRegistryAdapterConsumer;
  let caller: HardhatEthersSigner;

  beforeEach(async function () {
    let aggregators = [];

    const admin = (await ethers.getSigners())[9];
    const sequencer = (await ethers.getSigners())[10];
    const accessControlAdmin = (await ethers.getSigners())[5];
    const registryOwner = (await ethers.getSigners())[11];
    caller = (await ethers.getSigners())[6];

    const proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(admin, accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );

    for (const data of aggregatorData) {
      const newAdapter = new CLAdapterWrapper();
      await newAdapter.init(data.description, data.decimals, data.id, proxy);
      aggregators.push(newAdapter);
      const value = encodeDataAndTimestamp(data.id * 1000, data.id * 100000);
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

  it('Should compare results from adapter with those from adapter consumer', async function () {
    for (const { base, quote, description, decimals, id } of aggregatorData) {
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

      const answer = BigInt(id) * 1000n;
      const timestamp = BigInt(id) * 100000n;
      const encodedAnswer = encodeDataAndTimestamp(answer, timestamp);
      await feedRegistry.checkLatestAnswer(caller, base, quote, encodedAnswer);

      expect(
        await clFeedRegistryAdapterConsumer.getLatestAnswer(base, quote),
      ).to.deep.equal(answer);

      expect(
        await clFeedRegistryAdapterConsumer.getLatestRound(base, quote),
      ).to.deep.equal(1n);

      expect(
        await clFeedRegistryAdapterConsumer.getRoundData(base, quote, 1n),
      ).to.deep.equal([
        /* roundId_: */ 1n,
        /* answer_: */ answer,
        /* startedAt_: */ timestamp / 1000n,
        /* updatedAt_: */ timestamp / 1000n,
        /* answeredInRound_: */ 1n,
      ]);
      await feedRegistry.checkLatestRoundData(
        caller,
        base,
        quote,
        encodedAnswer,
        1n,
      );
    }
  });
});
