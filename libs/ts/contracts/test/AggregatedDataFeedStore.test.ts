import { expect } from 'chai';
import { AggregatedDataFeedStore } from '../typechain/contracts/AggregatedDataFeedStore';
import { deployContract } from './utils/helpers/common';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

enum ReadOp {
  GetFeedAtRound = '0x10',
  GetLatestFeed = '0x20',
  GetLatestRound = '0x40',
  GetLatestFeedAndRound = '0x60',
}

interface Feed {
  id: bigint;
  round: bigint;
  stride: bigint;
  slots: bigint;
  data: string;
}

const feeds: Feed[] = [
  {
    id: 1n,
    round: 6n,
    stride: 1n,
    slots: 1n,
    data: ethers.encodeBytes32String('0x1234'),
  },
  {
    id: 2n,
    round: 5n,
    stride: 0n,
    slots: 1n,
    data: ethers.encodeBytes32String('0x2456'),
  },
  {
    id: 3n,
    round: 4n,
    stride: 0n,
    slots: 1n,
    data: ethers.encodeBytes32String('0x3678'),
  },
  {
    id: 4n,
    round: 3n,
    stride: 0n,
    slots: 1n,
    data: ethers.encodeBytes32String('0x4890'),
  },
  {
    id: 5n,
    round: 2n,
    stride: 0n,
    slots: 1n,
    data: ethers.encodeBytes32String('0x5abc'),
  },
];

describe('AggregatedDataFeedStore', () => {
  let contract: AggregatedDataFeedStore;
  let signers: HardhatEthersSigner[];

  beforeEach(async () => {
    signers = await ethers.getSigners();
    console.log(signers[0].address);
    contract = await deployContract<AggregatedDataFeedStore>(
      'AggregatedDataFeedStore',
      signers[0].address,
    );
  });

  it('Should get latest round', async () => {
    await signers[0].sendTransaction({
      to: contract.target,
      data: encodeDataWrite(feeds),
    });

    for (const feed of feeds) {
      const data = encodeDataRead(ReadOp.GetLatestRound, feed);
      const res = await signers[0].call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(feed.round);
    }
  });

  it('Should get latest data', async () => {
    await signers[0].sendTransaction({
      to: contract.target,
      data: encodeDataWrite(feeds),
    });

    for (const feed of feeds) {
      const data = encodeDataRead(ReadOp.GetLatestFeed, feed);
      const res = await signers[0].call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(feed.data);
    }
  });

  it('Should get historical feed at round', async () => {
    await signers[0].sendTransaction({
      to: contract.target,
      data: encodeDataWrite(feeds),
    });

    const updatedFeeds = feeds.map(feed => {
      feed.round++;
      return feed;
    });

    await signers[0].sendTransaction({
      to: contract.target,
      data: encodeDataWrite(updatedFeeds),
    });

    for (const feed of feeds) {
      const data = encodeDataRead(ReadOp.GetFeedAtRound, feed);
      const res = await signers[0].call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(feed.data);
    }

    for (const feed of updatedFeeds) {
      const data = encodeDataRead(ReadOp.GetFeedAtRound, feed);
      const res = await signers[0].call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(feed.data);
    }
  });

  it('Should get latest feed and round after update', async () => {
    await signers[0].sendTransaction({
      to: contract.target,
      data: encodeDataWrite(feeds),
    });

    const updatedFeeds = feeds.map(feed => {
      feed.round++;
      return feed;
    });

    await signers[0].sendTransaction({
      to: contract.target,
      data: encodeDataWrite(updatedFeeds),
    });

    for (const feed of updatedFeeds) {
      const data = encodeDataRead(ReadOp.GetLatestFeedAndRound, feed);
      const res = await signers[0].call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(
        ethers.toBeHex(feed.round, 32).concat(
          ethers
            .toBeHex(feed.data)
            .padEnd(Number(feed.slots) * 32)
            .slice(2),
        ),
      );
    }
  });
});

const encodeDataWrite = (feeds: Feed[]) => {
  const prefix = ethers.solidityPacked(
    ['bytes4', 'uint64', 'uint32'],
    ['0x00000000', Date.now(), feeds.length],
  );

  const data = feeds.map(feed => {
    return ethers
      .solidityPacked(
        [
          'uint8',
          `uint${((feed.stride > 0 ? 17n + feed.stride / 8n : 16n) * 8n).toString()}`,
          'uint8',
          'bytes',
        ],
        [
          feed.stride,
          (feed.id * 2n ** 13n + feed.round) * 2n ** feed.stride,
          feed.slots,
          feed.data,
        ],
      )
      .slice(2);
  });

  feeds.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const batchFeeds: { [key: string]: string } = {};

  feeds.forEach(feed => {
    const rowIndex = ((2n ** 115n * feed.stride + feed.id) / 16n).toString();
    const slotPosition = Number(feed.id % 16n);

    if (!batchFeeds[rowIndex]) {
      // Initialize new row with zeros
      batchFeeds[rowIndex] = '0x' + '0'.repeat(64);
    }

    // Convert round to 2b hex and pad if needed
    const roundHex = feed.round.toString(16).padStart(4, '0');

    // Calculate position in the 32b row (64 hex chars)
    const position = slotPosition * 4;

    // Replace the corresponding 2b in the row
    batchFeeds[rowIndex] =
      batchFeeds[rowIndex].slice(0, position + 2) +
      roundHex +
      batchFeeds[rowIndex].slice(position + 6);
  });

  const roundData = ethers.solidityPacked(
    [
      ...Object.keys(batchFeeds)
        .map(() => ['uint128', 'bytes32'].flat())
        .flat(),
    ],
    [
      ...Object.keys(batchFeeds)
        .map(k => [k, batchFeeds[k]].flat())
        .flat(),
    ],
  );

  return prefix.concat(data.join('')).concat(roundData.slice(2));
};

const encodeDataRead = (operation: ReadOp, feed: Feed) => {
  const prefix = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint128'],
    [operation, feed.stride, feed.id],
  );

  if (operation === ReadOp.GetFeedAtRound) {
    return prefix.concat(
      ethers
        .solidityPacked(['uint16', 'uint8'], [feed.round, feed.slots])
        .slice(2),
    );
  }

  if (
    operation === ReadOp.GetLatestFeed ||
    operation === ReadOp.GetLatestFeedAndRound
  ) {
    return prefix.concat(
      ethers.solidityPacked(['uint8'], [feed.slots]).slice(2),
    );
  }

  return prefix;
};
