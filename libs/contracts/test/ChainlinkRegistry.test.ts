import { HistoricDataFeedStoreV1, HistoricDataFeedStoreV2 } from '../typechain';
import {
  ChainlinkBaseWrapper,
  ChainlinkRegistryBaseWrapper,
  ChainlinkRegistryV1Wrapper,
  ChainlinkV1Wrapper,
  ChainlinkV2Wrapper,
  UpgradeableProxyHistoricDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricDataFeedStoreV2Wrapper,
} from './utils/wrappers';
import {
  HistoricDataFeedStore,
  TOKENS,
  assertRegistry,
} from './utils/helpers/common';
import { ethers } from 'hardhat';

let contractWrapperV1: ChainlinkRegistryBaseWrapper<HistoricDataFeedStoreV1>;
let contractWrapperV2: ChainlinkRegistryBaseWrapper<HistoricDataFeedStoreV2>;

let contractWrappersV1: ChainlinkBaseWrapper<HistoricDataFeedStore>[] = [];
let contractWrappersV2: ChainlinkBaseWrapper<HistoricDataFeedStore>[] = [];

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

describe('Chainlink registry interface', async () => {
  beforeEach(async () => {
    contractWrappersV1 = [];
    contractWrappersV2 = [];

    const admin = (await ethers.getSigners())[5];

    const proxyV1 = new UpgradeableProxyHistoricDataFeedStoreV1Wrapper();
    await proxyV1.init(admin);

    const proxyV2 = new UpgradeableProxyHistoricDataFeedStoreV2Wrapper();
    await proxyV2.init(admin);

    for (const d of data) {
      contractWrappersV1.push(new ChainlinkV1Wrapper());
      contractWrappersV2.push(new ChainlinkV2Wrapper());

      await contractWrappersV1[contractWrappersV1.length - 1].init(
        ...Object.values(d),
        proxyV1,
      );

      await contractWrappersV2[contractWrappersV2.length - 1].init(
        ...Object.values(d),
        proxyV2,
      );
    }

    const owner = (await ethers.getSigners())[2];

    contractWrapperV1 = new ChainlinkRegistryV1Wrapper();
    await contractWrapperV1.init(owner);

    contractWrapperV2 = new ChainlinkRegistryV1Wrapper();
    await contractWrapperV2.init(owner);

    await contractWrapperV1.setFeed(
      TOKENS.ETH,
      TOKENS.USD,
      contractWrappersV1[0],
    );
    await contractWrapperV1.setFeed(
      TOKENS.BTC,
      TOKENS.USD,
      contractWrappersV1[1],
    );

    await contractWrapperV2.setFeed(
      TOKENS.ETH,
      TOKENS.USD,
      contractWrappersV2[0],
    );
    await contractWrapperV2.setFeed(
      TOKENS.BTC,
      TOKENS.USD,
      contractWrappersV2[1],
    );
  });

  it('Should return the correct feed', async () => {
    for (const [index, d] of data.entries()) {
      await assertRegistry(
        contractWrapperV1,
        contractWrapperV1.checkFeed,
        TOKENS[d.description.split('/')[0] as keyof typeof TOKENS],
        TOKENS[d.description.split('/')[1] as keyof typeof TOKENS],
        contractWrappersV1[index].contract.target as string,
      );

      await contractWrapperV2.checkFeed(
        TOKENS[d.description.split('/')[0] as keyof typeof TOKENS],
        TOKENS[d.description.split('/')[1] as keyof typeof TOKENS],
        contractWrappersV2[index].contract.target as string,
      );
    }
  });

  it('Should return the correct description', async () => {
    for (const [index, d] of data.entries()) {
      await contractWrappersV1[index].checkDescription(d.description);
      await contractWrappersV2[index].checkDescription(d.description);

      await assertRegistry(
        contractWrapperV1,
        contractWrapperV1.checkDescription,
        d.description,
        d.description,
      );

      await assertRegistry(
        contractWrapperV2,
        contractWrapperV2.checkDescription,
        d.description,
        d.description,
      );
    }
  });

  it('Should return the correct decimals', async () => {
    for (const [index, d] of data.entries()) {
      await contractWrappersV1[index].checkDecimals(d.decimals);
      await contractWrappersV2[index].checkDecimals(d.decimals);

      await assertRegistry(
        contractWrapperV1,
        contractWrapperV1.checkDecimals,
        d.description,
        d.decimals,
      );

      await assertRegistry(
        contractWrapperV2,
        contractWrapperV2.checkDecimals,
        d.description,
        d.decimals,
      );
    }
  });

  it('Should return the correct latest answer', async () => {
    const value = ethers.encodeBytes32String('3132');
    for (const i in contractWrappersV1) {
      await contractWrappersV1[i].setFeed(value);
      await contractWrappersV2[i].setFeed(value);
    }

    for (const i in contractWrappersV1) {
      await contractWrappersV1[i].checkLatestAnswer(BigInt(value));
      await contractWrappersV2[i].checkLatestAnswer(BigInt(value));
    }

    for (const d of data) {
      await assertRegistry(
        contractWrapperV1,
        contractWrapperV1.checkLatestAnswer,
        d.description,
        BigInt(value),
      );

      await assertRegistry(
        contractWrapperV2,
        contractWrapperV2.checkLatestAnswer,
        d.description,
        BigInt(value),
      );
    }
  });

  it('Should return the correct latest round id', async () => {
    const value = ethers.encodeBytes32String('3132');
    for (const i in contractWrappersV1) {
      await contractWrappersV1[i].setFeed(value);
      await contractWrappersV2[i].setFeed(value);
    }

    for (const i in contractWrappersV1) {
      await contractWrappersV1[i].checkLatestRoundId(1);
      await contractWrappersV2[i].checkLatestRoundId(1);
    }

    for (const d of data) {
      await assertRegistry(
        contractWrapperV1,
        contractWrapperV1.checkLatestRound,
        d.description,
        1,
      );

      await assertRegistry(
        contractWrapperV2,
        contractWrapperV2.checkLatestRound,
        d.description,
        1,
      );
    }
  });

  it('Should return the correct latest round data', async () => {
    let value = ethers.encodeBytes32String('3132');
    const ts1 = [];
    const ts2 = [];
    for (const i in contractWrappersV1) {
      const tx1 = await contractWrappersV1[i].setFeed(value);
      ts1.push((await ethers.provider.getBlock(tx1.blockNumber))?.timestamp!);

      const tx2 = await contractWrappersV2[i].setFeed(value);
      ts2.push((await ethers.provider.getBlock(tx2.blockNumber))?.timestamp!);
    }
    value = value.slice(0, 50);

    for (const i in contractWrappersV1) {
      await contractWrappersV1[i].checkLatestRoundData({
        answer: BigInt(value),
        startedAt: ts1[i],
        roundId: 1n,
      });

      await contractWrappersV2[i].checkLatestRoundData({
        answer: BigInt(value),
        startedAt: ts2[i],
        roundId: 1n,
      });
    }

    for (const [i, d] of data.entries()) {
      await assertRegistry(
        contractWrapperV1,
        contractWrapperV1.checkLatestRoundData,
        d.description,
        {
          answer: BigInt(value),
          startedAt: ts1[i],
          roundId: 1n,
        },
      );

      await assertRegistry(
        contractWrapperV2,
        contractWrapperV2.checkLatestRoundData,
        d.description,
        {
          answer: BigInt(value),
          startedAt: ts2[i],
          roundId: 1n,
        },
      );
    }
  });

  it('Should return the correct round data', async () => {
    let value = ethers.encodeBytes32String('3132');
    const ts1 = [];
    const ts2 = [];
    for (const i in contractWrappersV1) {
      const tx1 = await contractWrappersV1[i].setFeed(value);
      await contractWrappersV1[i].setFeed(value);
      ts1.push((await ethers.provider.getBlock(tx1.blockNumber))?.timestamp!);

      const tx2 = await contractWrappersV2[i].setFeed(value);
      await contractWrappersV2[i].setFeed(value);
      ts2.push((await ethers.provider.getBlock(tx2.blockNumber))?.timestamp!);
    }
    value = value.slice(0, 50);

    for (const i in contractWrappersV1) {
      await contractWrappersV1[i].checkRoundData(1, {
        answer: BigInt(value),
        startedAt: ts1[i],
      });

      await contractWrappersV2[i].checkRoundData(1, {
        answer: BigInt(value),
        startedAt: ts2[i],
      });
    }

    for (const [i, d] of data.entries()) {
      await assertRegistry(
        contractWrapperV1,
        contractWrapperV1.checkRoundData,
        d.description,
        1,
        {
          answer: BigInt(value),
          startedAt: ts1[i],
        },
      );

      await assertRegistry(
        contractWrapperV2,
        contractWrapperV2.checkRoundData,
        d.description,
        1,
        {
          answer: BigInt(value),
          startedAt: ts2[i],
        },
      );
    }
  });
});
