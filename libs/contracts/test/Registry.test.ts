import {
  ChainlinkBaseWrapper,
  ChainlinkRegistryBaseWrapper,
  ChainlinkV1Wrapper,
  ChainlinkV2Wrapper,
  RegistryWrapper,
  UpgradeableProxyHistoricDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricDataFeedStoreV2Wrapper,
} from './utils/wrappers';
import { callAndCompareRegistries } from './utils/helpers/registryGasHelper';
import { HistoricDataFeedStore, TOKENS } from './utils/helpers/common';
import { ethers } from 'hardhat';
import { expect } from 'chai';

let registryWrapperV1: ChainlinkRegistryBaseWrapper;
let registryWrapperV2: ChainlinkRegistryBaseWrapper;

let chainlinkProxyWrappersV1: ChainlinkBaseWrapper<HistoricDataFeedStore>[] =
  [];
let chainlinkProxyWrappersV2: ChainlinkBaseWrapper<HistoricDataFeedStore>[] =
  [];

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
    const proxyV1 = new UpgradeableProxyHistoricDataFeedStoreV1Wrapper();
    await proxyV1.init(admin);

    const proxyV2 = new UpgradeableProxyHistoricDataFeedStoreV2Wrapper();
    await proxyV2.init(admin);

    for (const d of data) {
      chainlinkProxyWrappersV1.push(new ChainlinkV1Wrapper());
      chainlinkProxyWrappersV2.push(new ChainlinkV2Wrapper());

      await chainlinkProxyWrappersV1[chainlinkProxyWrappersV1.length - 1].init(
        ...Object.values(d),
        proxyV1,
      );

      await chainlinkProxyWrappersV2[chainlinkProxyWrappersV2.length - 1].init(
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
      await chainlinkProxyWrappersV1[i].setFeed(value);
      await chainlinkProxyWrappersV2[i].setFeed(value);
    }

    const owner = (await ethers.getSigners())[2];

    registryWrapperV1 = new ChainlinkRegistryBaseWrapper('ChainlinkRegistryV1');
    await registryWrapperV1.init(owner);

    registryWrapperV2 = new ChainlinkRegistryBaseWrapper('ChainlinkRegistryV2');
    await registryWrapperV2.init(owner);

    const registryV1 = new RegistryWrapper(
      'Blocksense V1',
      chainlinkProxyWrappersV1.map(wrapper => wrapper.contract),
    );
    await registryV1.init(
      owner.address,
      registryWrapperV1.contract.target as string,
    );

    const registryV2 = new RegistryWrapper(
      'Blocksense V2',
      chainlinkProxyWrappersV2.map(wrapper => wrapper.contract),
    );
    await registryV2.init(
      owner.address,
      registryWrapperV2.contract.target as string,
    );

    await registryWrapperV1.setFeed(
      TOKENS.ETH,
      TOKENS.USD,
      chainlinkProxyWrappersV1[0],
    );
    await registryWrapperV1.setFeed(
      TOKENS.BTC,
      TOKENS.USD,
      chainlinkProxyWrappersV1[1],
    );

    await registryWrapperV2.setFeed(
      TOKENS.ETH,
      TOKENS.USD,
      chainlinkProxyWrappersV2[0],
    );
    await registryWrapperV2.setFeed(
      TOKENS.BTC,
      TOKENS.USD,
      chainlinkProxyWrappersV2[1],
    );

    registryV1.underliers = chainlinkProxyWrappersV1.map(
      wrapper => wrapper.contract,
    );
    registryV2.underliers = chainlinkProxyWrappersV2.map(
      wrapper => wrapper.contract,
    );

    const chainlinkFeedRegistry = await ethers.getContractAt(
      'IFeedRegistry',
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

  describe('Chainlink vs Blocksense registry historic functions', async function () {
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
