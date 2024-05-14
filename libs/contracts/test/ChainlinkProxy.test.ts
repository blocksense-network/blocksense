import { expect } from 'chai';
import { HistoricDataFeedStore } from './utils/helpers/common';
import {
  ChainlinkBaseWrapper,
  ChainlinkV1Wrapper,
  ChainlinkV2Wrapper,
  UpgradeableProxyHistoricDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricDataFeedStoreV2Wrapper,
} from './utils/wrappers';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';

let contractWrappersV1: ChainlinkBaseWrapper<HistoricDataFeedStore>[] = [];
let contractWrappersV2: ChainlinkBaseWrapper<HistoricDataFeedStore>[] = [];
let contractWrappers = [contractWrappersV1, contractWrappersV2];

const proxyData = [
  {
    description: 'ETH/USDC',
    decimals: 8,
    key: 0,
  },
  {
    description: 'BTC/USDC',
    decimals: 6,
    key: 0,
  },
];

describe('Chainlink proxy interface', function () {
  let admin: Signer;

  beforeEach(async function () {
    contractWrappersV1 = [];
    contractWrappersV2 = [];

    admin = (await ethers.getSigners())[5];

    const proxyV1 = new UpgradeableProxyHistoricDataFeedStoreV1Wrapper();
    await proxyV1.init(admin);

    const proxyV2 = new UpgradeableProxyHistoricDataFeedStoreV2Wrapper();
    await proxyV2.init(admin);

    for (const data of proxyData) {
      contractWrappersV1.push(new ChainlinkV1Wrapper());
      contractWrappersV2.push(new ChainlinkV2Wrapper());

      await contractWrappersV1[contractWrappersV1.length - 1].init(
        ...Object.values(data),
        proxyV1,
      );

      await contractWrappersV2[contractWrappersV2.length - 1].init(
        ...Object.values(data),
        proxyV2,
      );
    }

    contractWrappers = [contractWrappersV1, contractWrappersV2];
  });

  it('Should check description', async function () {
    for (const [index, data] of proxyData.entries()) {
      await contractWrappersV1[index].checkDescription(data.description);
      await contractWrappersV2[index].checkDescription(data.description);
    }
  });

  it('Should check decimals', async function () {
    for (const [index, data] of proxyData.entries()) {
      await contractWrappersV1[index].checkDecimals(data.decimals);
      await contractWrappersV2[index].checkDecimals(data.decimals);
    }
  });

  describe('Assert storage', function () {
    for (const version in contractWrappers) {
      for (let i = 0; i < proxyData.length; i++) {
        it(`Should get latest answer for ${proxyData[i].description} v${+version + 1}`, async function () {
          const wrappers = contractWrappers[version];
          const value = ethers.encodeBytes32String('3132');
          await wrappers[version].setFeed(value);

          await wrappers[version].checkSetValue(value);
          await wrappers[version].checkLatestAnswer(BigInt(value));

          const newValue = ethers.encodeBytes32String('1234');
          await wrappers[version].proxy.setFeeds(
            [proxyData[i].key],
            [newValue],
          );

          await wrappers[version].checkSetValue(newValue);
          await wrappers[version].checkLatestAnswer(BigInt(newValue));
        });

        it(`Should get latest round id for ${proxyData[i].description} v${+version + 1}`, async function () {
          const wrappers = contractWrappers[version];

          const value = ethers.encodeBytes32String('3132');
          await wrappers[version].setFeed(value);

          await wrappers[version].checkSetValue(value);
          await wrappers[version].checkLatestRoundId(1);

          const newValue = ethers.encodeBytes32String('1234');
          await wrappers[version].proxy.setFeeds(
            [proxyData[i].key],
            [newValue],
          );

          await wrappers[version].checkSetValue(newValue);
          await wrappers[version].checkLatestRoundId(2);
        });

        it(`Should get latest round data for ${proxyData[i].description} v${+version + 1}`, async function () {
          const wrappers = contractWrappers[version];

          const value = ethers.encodeBytes32String('3132');
          const tx = await wrappers[version].setFeed(value);

          await wrappers[version].checkSetValue(value);
          await wrappers[version].checkLatestRoundData({
            answer: ethers.toBigInt(value.slice(0, 50)),
            roundId: 1n,
            startedAt: (await ethers.provider.getBlock(tx.blockNumber))
              ?.timestamp!,
          });

          const newValue = ethers.encodeBytes32String('1234');
          const tx2 = await wrappers[version].proxy.setFeeds(
            [proxyData[i].key],
            [newValue],
          );

          await wrappers[version].checkSetValue(newValue);
          await wrappers[version].checkLatestRoundData({
            answer: BigInt(newValue.slice(0, 50)),
            roundId: 2n,
            startedAt: (await ethers.provider.getBlock(tx2.blockNumber))
              ?.timestamp!,
          });
        });

        it(`Should get historical data for ${proxyData[i].description} v${+version + 1}`, async function () {
          const wrappers = contractWrappers[version];

          const value = ethers.encodeBytes32String('3132');
          const tx1 = await wrappers[version].setFeed(value);
          const newValue = ethers.encodeBytes32String('1234');
          const tx2 = await wrappers[version].setFeed(newValue);

          await wrappers[version].checkSetValue(newValue);
          await wrappers[version].checkRoundData(1, {
            answer: BigInt(value.slice(0, 50)),
            startedAt: (await ethers.provider.getBlock(tx1.blockNumber))
              ?.timestamp!,
          });

          await wrappers[version].checkRoundData(2, {
            answer: BigInt(newValue.slice(0, 50)),
            startedAt: (await ethers.provider.getBlock(tx2.blockNumber))
              ?.timestamp!,
          });

          const newValue2 = ethers.encodeBytes32String('12348747364');
          const tx3 = await wrappers[version].proxy.setFeeds(
            [proxyData[i].key],
            [newValue2],
          );

          await wrappers[version].checkSetValue(newValue2);
          await wrappers[version].checkRoundData(3, {
            answer: BigInt(newValue2.slice(0, 50)),
            startedAt: (await ethers.provider.getBlock(tx3.blockNumber))
              ?.timestamp!,
          });
        });
      }
    }
  });
});
