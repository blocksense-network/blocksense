import {
  CLBaseWrapper,
  CLRegistryBaseWrapper as CLRegistryBaseWrapperExp,
  CLV1Wrapper,
  CLV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from './experiments/utils/wrappers';
import {
  CLAdapterWrapper,
  CLRegistryBaseWrapper,
  UpgradeableProxyADFSWrapper,
} from './utils/wrappers';
import { callAndCompareRegistries } from './utils/helpers/registryGasHelper';
import {
  HistoricalDataFeedStore,
  TOKENS,
} from './experiments/utils/helpers/common';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { RegistryWrapper } from './utils/wrappers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { encodeData, encodeDataAndTimestamp } from './utils/helpers/common';

let registryWrapperV1: CLRegistryBaseWrapperExp;
let registryWrapperV2: CLRegistryBaseWrapperExp;
let clRegistry: CLRegistryBaseWrapper;

let aggregatorWrappersV1: CLBaseWrapper<HistoricalDataFeedStore>[] = [];
let aggregatorWrappersV2: CLBaseWrapper<HistoricalDataFeedStore>[] = [];
let clAdapters: CLAdapterWrapper[] = [];

let data = [
  {
    description: 'ETH/USD',
    decimals: 8,
    id: 15,
    base: TOKENS.ETH,
    quote: TOKENS.USD,
  },
  {
    description: 'BTC/USD',
    decimals: 6,
    id: 18,
    base: TOKENS.BTC,
    quote: TOKENS.USD,
  },
];

describe('Gas usage comparison between Chainlink and Blocksense registry @fork', () => {
  let registries: RegistryWrapper[];
  let chainlinkRegistryWrappers: RegistryWrapper[];
  let admin: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;
  let accessControlAdmin: HardhatEthersSigner;
  let proxy: UpgradeableProxyADFSWrapper;
  let caller: HardhatEthersSigner;
  let registryOwner: HardhatEthersSigner;

  before(async function () {
    if (process.env.FORKING !== 'true') {
      this.skip();
    }

    admin = (await ethers.getSigners())[9];
    sequencer = (await ethers.getSigners())[10];
    accessControlAdmin = (await ethers.getSigners())[5];
    caller = (await ethers.getSigners())[6];
    registryOwner = (await ethers.getSigners())[11];

    proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(admin, accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );

    for (const d of data) {
      const adapter = new CLAdapterWrapper();
      await adapter.init(d.description, d.decimals, d.id, proxy);
      clAdapters.push(adapter);
    }

    const proxyV1 = new UpgradeableProxyHistoricalDataFeedStoreV1Wrapper();
    await proxyV1.init(admin);

    const proxyV2 = new UpgradeableProxyHistoricalDataFeedStoreV2Wrapper();
    await proxyV2.init(admin);

    for (const d of data) {
      aggregatorWrappersV1.push(new CLV1Wrapper());
      aggregatorWrappersV2.push(new CLV2Wrapper());

      await aggregatorWrappersV1[aggregatorWrappersV1.length - 1].init(
        d.description,
        d.decimals,
        d.id,
        proxyV1,
      );

      await aggregatorWrappersV2[aggregatorWrappersV2.length - 1].init(
        d.description,
        d.decimals,
        d.id,
        proxyV2,
      );
    }

    const valueETH = encodeDataAndTimestamp(312343354);
    const valueBTC = encodeDataAndTimestamp(3123434);
    for (const [i, value] of [valueETH, valueBTC].entries()) {
      await aggregatorWrappersV1[i].setFeed(value);
      await aggregatorWrappersV2[i].setFeed(value);
      await clAdapters[i].setFeed(sequencer, value, 1n);
    }

    registryWrapperV1 = new CLRegistryBaseWrapperExp(
      'CLRegistryV1',
      proxyV1.contract,
    );
    await registryWrapperV1.init(registryOwner);

    registryWrapperV2 = new CLRegistryBaseWrapperExp(
      'CLRegistryV2',
      proxyV2.contract,
    );
    await registryWrapperV2.init(registryOwner);

    clRegistry = new CLRegistryBaseWrapper('CLRegistry', proxy.contract);
    await clRegistry.init(registryOwner);

    const registryV1 = new RegistryWrapper(
      'Blocksense V1',
      aggregatorWrappersV1.map(wrapper => wrapper.contract),
    );
    await registryV1.init(registryWrapperV1.contract.target as string);

    const registryV2 = new RegistryWrapper(
      'Blocksense V2',
      aggregatorWrappersV2.map(wrapper => wrapper.contract),
    );
    await registryV2.init(registryWrapperV2.contract.target as string);

    const registryADFS = new RegistryWrapper(
      'Blocksense ADFS',
      clAdapters.map(adapter => adapter.contract),
    );
    await registryADFS.init(clRegistry.contract.target as string);

    await registryWrapperV1.setFeeds(
      data.map((d, i) => {
        return {
          base: d.base,
          quote: d.quote,
          feed: aggregatorWrappersV1[i],
        };
      }),
    );
    await registryWrapperV2.setFeeds(
      data.map((d, i) => {
        return {
          base: d.base,
          quote: d.quote,
          feed: aggregatorWrappersV2[i],
        };
      }),
    );
    await clRegistry.setFeeds(
      data.map((d, i) => {
        return {
          base: d.base,
          quote: d.quote,
          feed: clAdapters[i],
        };
      }),
    );

    registryV1.underliers = aggregatorWrappersV1.map(
      wrapper => wrapper.contract,
    );
    registryV2.underliers = aggregatorWrappersV2.map(
      wrapper => wrapper.contract,
    );
    registryADFS.underliers = clAdapters.map(adapter => adapter.contract);

    const chainlinkFeedRegistry = await ethers.getContractAt(
      'ICLFeedRegistryAdapter',
      '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
    );

    const chainlinkRegistryWrapper = new RegistryWrapper('Chainlink', []);
    await chainlinkRegistryWrapper.init(chainlinkFeedRegistry.target as string);

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

    registries = [registryV1, registryV2, registryADFS];
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
      await clRegistry.checkFeed(TOKENS.ETH, TOKENS.USD, feeds[2]);

      expect(feeds[3]).to.be.equal(
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
      await clRegistry.checkDecimals(
        TOKENS.ETH,
        TOKENS.USD,
        Number(decimals[2]),
      );

      expect(decimals[3]).to.be.equal(
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
      await clRegistry.checkDescription(
        TOKENS.ETH,
        TOKENS.USD,
        descriptions[2],
      );

      expect(descriptions[3]).to.be.equal(
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
      await clRegistry.checkLatestAnswer(
        caller,
        TOKENS.ETH,
        TOKENS.USD,
        encodeData(latestAnswers[2]),
      );

      expect(latestAnswers[3]).to.be.equal(
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
      await clRegistry.checkLatestRound(
        caller,
        TOKENS.ETH,
        TOKENS.USD,
        latestRounds[2],
      );

      expect(latestRounds[3]).to.be.equal(
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
      await clRegistry.checkLatestRoundData(
        caller,
        TOKENS.ETH,
        TOKENS.USD,
        encodeDataAndTimestamp(answers[2], updates[2]),
        roundData[2].roundId,
      );

      const chainlinkRoundData =
        await chainlinkRegistryWrappers[0].registry.latestRoundData(
          TOKENS.ETH,
          TOKENS.USD,
        );
      expect(roundData[3].roundId).to.be.equal(chainlinkRoundData[0]);
      expect(roundData[3].answer).to.be.equal(chainlinkRoundData[1]);
      expect(roundData[3].startedAt).to.be.equal(chainlinkRoundData[2]);
      expect(roundData[3].roundId).to.be.equal(chainlinkRoundData[4]);
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
      await clRegistry.checkRoundData(
        caller,
        TOKENS.ETH,
        TOKENS.USD,
        encodeDataAndTimestamp(answers[2], updates[2]),
        1n,
      );

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
      expect(roundData[1]).to.be.equal(answers[3]);
      expect(roundData[2]).to.be.equal(updates[3]);
      expect(roundData[2]).to.be.equal(updates[3]);
      expect(roundData[4]).to.be.equal(roundId);
    });
  });
});
