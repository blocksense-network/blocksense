import {
  CLBaseWrapper,
  CLRegistryBaseWrapper,
  CLV1Wrapper,
  CLV2Wrapper,
  RegistryWrapper,
  UpgradeableProxyHistoricalDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from './utils/wrappers';
import { callAndCompareRegistries } from './utils/helpers/registryGasHelper';
import { HistoricalDataFeedStore, TOKENS } from './utils/helpers/common';
import { ethers } from 'hardhat';
import { expect } from 'chai';

let registryWrapperV1: CLRegistryBaseWrapper;
let registryWrapperV2: CLRegistryBaseWrapper;

let aggregatorWrappersV1: CLBaseWrapper<HistoricalDataFeedStore>[] = [];
let aggregatorWrappersV2: CLBaseWrapper<HistoricalDataFeedStore>[] = [];

let data = [
  {
    description: 'ETH/USD',
    decimals: 8,
    key: 15,
  },
  {
    description: 'BTC/USD',
    decimals: 6,
    key: 18,
  },
];

describe('Gas usage comparison between Chainlink and Blocksense registry @fork', () => {
  let registries: RegistryWrapper[];
  let chainlinkRegistryWrappers: RegistryWrapper[];

  before(async function () {
    if (process.env.FORKING !== 'true') {
      this.skip();
    }

    const admin = (await ethers.getSigners())[5];
    const proxyV1 = new UpgradeableProxyHistoricalDataFeedStoreV1Wrapper();
    await proxyV1.init(admin);

    const proxyV2 = new UpgradeableProxyHistoricalDataFeedStoreV2Wrapper();
    await proxyV2.init(admin);

    for (const d of data) {
      aggregatorWrappersV1.push(new CLV1Wrapper());
      aggregatorWrappersV2.push(new CLV2Wrapper());

      await aggregatorWrappersV1[aggregatorWrappersV1.length - 1].init(
        ...Object.values(d),
        proxyV1,
      );

      await aggregatorWrappersV2[aggregatorWrappersV2.length - 1].init(
        ...Object.values(d),
        proxyV2,
      );
    }

    const valueETH = ethers
      .zeroPadValue(ethers.toUtf8Bytes('312343354'), 24)
      .padEnd(66, '0');
    const valueBTC = ethers
      .zeroPadValue(ethers.toUtf8Bytes('3123434'), 24)
      .padEnd(66, '0');
    for (const [i, value] of [valueETH, valueBTC].entries()) {
      await aggregatorWrappersV1[i].setFeed(value);
      await aggregatorWrappersV2[i].setFeed(value);
    }

    const owner = (await ethers.getSigners())[2];

    registryWrapperV1 = new CLRegistryBaseWrapper(
      'CLRegistryV1',
      proxyV1.contract,
    );
    await registryWrapperV1.init(owner);

    registryWrapperV2 = new CLRegistryBaseWrapper(
      'CLRegistryV2',
      proxyV2.contract,
    );
    await registryWrapperV2.init(owner);

    const registryV1 = new RegistryWrapper(
      'Blocksense V1',
      aggregatorWrappersV1.map(wrapper => wrapper.contract),
    );
    await registryV1.init(
      owner.address,
      registryWrapperV1.contract.target as string,
    );

    const registryV2 = new RegistryWrapper(
      'Blocksense V2',
      aggregatorWrappersV2.map(wrapper => wrapper.contract),
    );
    await registryV2.init(
      owner.address,
      registryWrapperV2.contract.target as string,
    );

    await registryWrapperV1.setFeeds([
      {
        base: TOKENS.ETH,
        quote: TOKENS.USD,
        feed: aggregatorWrappersV1[0],
      },
      {
        base: TOKENS.BTC,
        quote: TOKENS.USD,
        feed: aggregatorWrappersV1[1],
      },
    ]);

    await registryWrapperV2.setFeeds([
      {
        base: TOKENS.ETH,
        quote: TOKENS.USD,
        feed: aggregatorWrappersV2[0],
      },
      {
        base: TOKENS.BTC,
        quote: TOKENS.USD,
        feed: aggregatorWrappersV2[1],
      },
    ]);

    registryV1.underliers = aggregatorWrappersV1.map(
      wrapper => wrapper.contract,
    );
    registryV2.underliers = aggregatorWrappersV2.map(
      wrapper => wrapper.contract,
    );

    const chainlinkFeedRegistry = await ethers.getContractAt(
      'ICLFeedRegistryAdapter',
      '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
    );

    const chainlinkRegistryWrapper = new RegistryWrapper('Chainlink', []);
    await chainlinkRegistryWrapper.init(
      chainlinkFeedRegistry.target as string,
      chainlinkFeedRegistry.target as string,
    );

    const ethAddress = await chainlinkFeedRegistry.getFeed(
      TOKENS.ETH,
      TOKENS.USD,
    );
    const btcAddress = await chainlinkFeedRegistry.getFeed(
      TOKENS.BTC,
      TOKENS.USD,
    );

    chainlinkRegistryWrapper.underliers = [
      await ethers.getContractAt('IChainlinkAggregator', ethAddress),
      await ethers.getContractAt('IChainlinkAggregator', btcAddress),
    ];

    chainlinkRegistryWrappers = [chainlinkRegistryWrapper];

    registries = [registryV1, registryV2];
  });

  describe('Chainlink vs Blocksense registry base functions', async function () {
    it('Should compare getFeed', async () => {
      await callAndCompareRegistries(
        registries,
        chainlinkRegistryWrappers,
        'setFeed',
        TOKENS.ETH,
        TOKENS.USD,
      );

      const feeds = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.feed(),
        ),
      );

      await registryWrapperV1.checkFeed(TOKENS.ETH, TOKENS.USD, feeds[0]);
      await registryWrapperV2.checkFeed(TOKENS.ETH, TOKENS.USD, feeds[1]);

      expect(feeds[2]).to.be.equal(
        await chainlinkRegistryWrappers[0].registry.getFeed(
          TOKENS.ETH,
          TOKENS.USD,
        ),
      );
    });

    it('Should compare setDecimals', async () => {
      await callAndCompareRegistries(
        registries,
        chainlinkRegistryWrappers,
        'setDecimals',
        TOKENS.ETH,
        TOKENS.USD,
      );

      const decimals = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.decimals(),
        ),
      );

      await registryWrapperV1.checkDecimals(
        TOKENS.ETH,
        TOKENS.USD,
        Number(decimals[0]),
      );
      await registryWrapperV2.checkDecimals(
        TOKENS.ETH,
        TOKENS.USD,
        Number(decimals[1]),
      );

      expect(decimals[2]).to.be.equal(
        await chainlinkRegistryWrappers[0].registry.decimals(
          TOKENS.ETH,
          TOKENS.USD,
        ),
      );
    });

    it('Should compare setDescription', async () => {
      await callAndCompareRegistries(
        registries,
        chainlinkRegistryWrappers,
        'setDescription',
        TOKENS.ETH,
        TOKENS.USD,
      );

      const descriptions = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.description(),
        ),
      );

      await registryWrapperV1.checkDescription(
        TOKENS.ETH,
        TOKENS.USD,
        descriptions[0],
      );
      await registryWrapperV2.checkDescription(
        TOKENS.ETH,
        TOKENS.USD,
        descriptions[1],
      );

      expect(descriptions[2]).to.be.equal(
        await chainlinkRegistryWrappers[0].registry.description(
          TOKENS.ETH,
          TOKENS.USD,
        ),
      );
    });

    it('Should compare setLatestAnswer', async () => {
      await callAndCompareRegistries(
        registries,
        chainlinkRegistryWrappers,
        'setLatestAnswer',
        TOKENS.ETH,
        TOKENS.USD,
      );

      const latestAnswers = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.price(),
        ),
      );

      await registryWrapperV1.checkLatestAnswer(
        TOKENS.ETH,
        TOKENS.USD,
        latestAnswers[0],
      );
      await registryWrapperV2.checkLatestAnswer(
        TOKENS.ETH,
        TOKENS.USD,
        latestAnswers[1],
      );
      expect(latestAnswers[2]).to.be.equal(
        await chainlinkRegistryWrappers[0].registry.latestAnswer(
          TOKENS.ETH,
          TOKENS.USD,
        ),
      );
    });

    it('Should compare setLatestRoundId', async () => {
      await callAndCompareRegistries(
        registries,
        chainlinkRegistryWrappers,
        'setLatestRoundId',
        TOKENS.ETH,
        TOKENS.USD,
      );

      const latestRounds = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.roundId(),
        ),
      );

      await registryWrapperV1.checkLatestRound(
        TOKENS.ETH,
        TOKENS.USD,
        Number(latestRounds[0]),
      );
      await registryWrapperV2.checkLatestRound(
        TOKENS.ETH,
        TOKENS.USD,
        Number(latestRounds[1]),
      );
      expect(latestRounds[2]).to.be.equal(
        await chainlinkRegistryWrappers[0].registry.latestRound(
          TOKENS.ETH,
          TOKENS.USD,
        ),
      );
    });
  });

  describe('Chainlink vs Blocksense registry historical functions', async function () {
    it('Should compare setLatestRoundData', async () => {
      await callAndCompareRegistries(
        registries,
        chainlinkRegistryWrappers,
        'setLatestRoundData',
        TOKENS.ETH,
        TOKENS.USD,
      );

      const roundIds = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.roundId(),
        ),
      );
      const answers = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.price(),
        ),
      );
      const updates = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.lastUpdate(),
        ),
      );

      const roundData = roundIds.map((roundId, i) => ({
        roundId: roundId,
        answer: answers[i],
        startedAt: Number(updates[i]),
      }));

      await registryWrapperV1.checkLatestRoundData(
        TOKENS.ETH,
        TOKENS.USD,
        roundData[0],
      );
      await registryWrapperV2.checkLatestRoundData(
        TOKENS.ETH,
        TOKENS.USD,
        roundData[1],
      );

      const chainlinkRoundData =
        await chainlinkRegistryWrappers[0].registry.latestRoundData(
          TOKENS.ETH,
          TOKENS.USD,
        );
      expect(roundData[2].roundId).to.be.equal(chainlinkRoundData[0]);
      expect(roundData[2].answer).to.be.equal(chainlinkRoundData[1]);
      expect(roundData[2].startedAt).to.be.equal(chainlinkRoundData[2]);
      expect(roundData[2].startedAt).to.be.equal(chainlinkRoundData[3]);
      expect(roundData[2].roundId).to.be.equal(chainlinkRoundData[4]);
    });

    it('Should compare setRoundData', async () => {
      await callAndCompareRegistries(
        registries,
        chainlinkRegistryWrappers,
        'setRoundData',
        TOKENS.ETH,
        TOKENS.USD,
        1,
      );

      const answers = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.price(),
        ),
      );
      const updates = await Promise.all(
        [...registries, ...chainlinkRegistryWrappers].map(registry =>
          registry.contract.lastUpdate(),
        ),
      );

      await registryWrapperV1.checkRoundData(TOKENS.ETH, TOKENS.USD, 1, {
        answer: answers[0],
        startedAt: Number(updates[0]),
      });
      await registryWrapperV2.checkRoundData(TOKENS.ETH, TOKENS.USD, 1, {
        answer: answers[1],
        startedAt: Number(updates[1]),
      });

      const roundId =
        (await chainlinkRegistryWrappers[0].registry.latestRound(
          TOKENS.ETH,
          TOKENS.USD,
        )) - 4n;
      const roundData =
        await chainlinkRegistryWrappers[0].registry.getRoundData(
          TOKENS.ETH,
          TOKENS.USD,
          roundId,
        );

      expect(roundData[0]).to.be.equal(roundId);
      expect(roundData[1]).to.be.equal(answers[2]);
      expect(roundData[2]).to.be.equal(updates[2]);
      expect(roundData[2]).to.be.equal(updates[2]);
      expect(roundData[4]).to.be.equal(roundId);
    });
  });
});
