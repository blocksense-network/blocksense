import { ethers } from 'hardhat';
import { deployContract } from '../experiments/utils/helpers/common';
import { ADFSConsumer, RawCallADFSConsumer } from '../../typechain';
import * as utils from './utils/feedStoreConsumer';
import { expect } from 'chai';
import { ADFSWrapper } from '../utils/wrappers';
import { encodeDataAndTimestamp } from '../utils/helpers/common';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Feed } from '../utils/wrappers/types';

const feeds: Feed[] = [
  {
    id: 1n,
    round: 1n,
    stride: 0n,
    data: ethers.hexlify(ethers.randomBytes(32)),
  },
  {
    id: 1n,
    round: 8191n,
    stride: 0n,
    data: ethers.hexlify(ethers.randomBytes(32)),
  },
  {
    id: 1n,
    round: 1n,
    stride: 4n,
    data: ethers.hexlify(ethers.randomBytes(2 ** 4 * 32)),
  },
];

describe('Example: ADFSConsumer', function () {
  let dataFeedStore: ADFSWrapper;
  let adfsConsumer: ADFSConsumer;
  let rawCallADFSConsumer: RawCallADFSConsumer;
  let sequencer: HardhatEthersSigner;

  const key = 1;
  const round = 1n;

  beforeEach(async function () {
    sequencer = (await ethers.getSigners())[0];
    const accessControlOwner = (await ethers.getSigners())[1];

    dataFeedStore = new ADFSWrapper();
    await dataFeedStore.init(accessControlOwner);
    await dataFeedStore.accessControl.setAdminStates(
      accessControlOwner,
      [sequencer.address],
      [true],
    );

    await dataFeedStore.setFeeds(sequencer, feeds);

    adfsConsumer = await deployContract<ADFSConsumer>(
      'ADFSConsumer',
      dataFeedStore.contract.target,
    );
    rawCallADFSConsumer = await deployContract<RawCallADFSConsumer>(
      'RawCallADFSConsumer',
      dataFeedStore.contract.target,
    );
  });

  [
    { title: 'get latest single feed', fnName: 'getLatestSingleFeedData' },
    {
      title: 'get latest single feed and round',
      fnName: 'getLatestSingleFeedDataAndRound',
    },
    {
      title: 'get single feed data at round',
      fnName: 'getSingleFeedDataAtRound',
    },
  ].forEach(data => {
    it(`Should ${data.title}`, async function () {
      await getAndCompareData(
        [null, key, round],
        data.fnName as keyof typeof utils,
      );
    });
  });

  [
    {
      title: 'get latest feed',
      fnName: 'getLatestFeedData',
    },
    {
      title: 'get latest feed and round',
      fnName: 'getLatestFeedDataAndRound',
    },
    {
      title: 'get feed data at round',
      fnName: 'getFeedDataAtRound',
    },
  ].forEach(data => {
    const feedsWithMultipleSlots = feeds.filter(feed => feed.stride > 0);
    for (const feed of feedsWithMultipleSlots) {
      it(`Should ${data.title} for stride ${feed.stride}`, async function () {
        await getAndCompareData(
          [feed.stride, key, round],
          data.fnName as keyof typeof utils,
        );
      });
    }
  });

  [
    {
      title: 'get latest sliced feed',
      fnName: 'getLatestSlicedFeedData',
    },
    {
      title: 'get latest sliced feed and round',
      fnName: 'getLatestSlicedFeedDataAndRound',
    },
    {
      title: 'get sliced feed data at round',
      fnName: 'getSlicedFeedDataAtRound',
    },
  ].forEach(data => {
    const feedsWithMultipleSlots = feeds.filter(feed => feed.stride > 0);
    for (const feed of feedsWithMultipleSlots) {
      for (let i = 0; i < 2n ** feed.stride; i++) {
        it(`Should ${data.title} for stride ${feed.stride} and slice(${i}, ${Number(2n ** feed.stride) - i})`, async function () {
          await getAndCompareData(
            [
              feed.stride,
              key,
              data.fnName === 'getSlicedFeedDataAtRound' ? round : null,
              i,
              Number(2n ** feed.stride) - i,
            ],
            data.fnName as keyof typeof utils,
          );
        });
      }
    }
  });

  for (const feed of feeds) {
    it(`Should get latest round for stride ${feed.stride}`, async function () {
      await getAndCompareData([feed.stride, feed.id], 'getLatestRound');
    });
  }

  it('Should get latest timestamp in seconds', async function () {
    const timestampNow = Date.now();
    const feedData = encodeDataAndTimestamp(1234, timestampNow);
    const feed = {
      id: 1n,
      round: 1n,
      stride: 0n,
      data: feedData,
    };
    await dataFeedStore.setFeeds(sequencer, [feed]);

    const timestamp = await adfsConsumer.getEpochSeconds(feed.id);
    expect(timestamp).to.be.equal(Math.floor(timestampNow / 1000));
  });

  it('Should get latest timestamp in milliseconds', async function () {
    const timestampNow = Date.now();
    const feedData = encodeDataAndTimestamp(1234, timestampNow);
    const feed = {
      id: 1n,
      round: 1n,
      stride: 0n,
      data: feedData,
    };
    await dataFeedStore.setFeeds(sequencer, [feed]);

    const timestamp = await adfsConsumer.getEpochMilliseconds(feed.id);
    expect(timestamp).to.be.equal(timestampNow);
  });

  const getAndCompareData = async (
    data: any[],
    functionName: keyof typeof utils,
  ) => {
    const inputsCount =
      adfsConsumer.interface.getFunction(functionName).inputs.length;
    const filteredData = data.filter(v => v !== null).slice(0, inputsCount);

    const adfsData = await adfsConsumer.getFunction(functionName)(
      ...filteredData,
    );
    const rawCallData = await rawCallADFSConsumer.getFunction(functionName)(
      ...filteredData,
    );

    const utilData = await utils[functionName](
      await dataFeedStore.contract.getAddress(),
      data,
    );

    expect(adfsData).to.deep.equal(utilData);
    expect(rawCallData).to.deep.equal(utilData);
  };
});
