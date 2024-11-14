import { expect } from 'chai';
import { AggregatedDataFeedStore } from '../typechain/contracts/AggregatedDataFeedStore';
import { deployContract } from './utils/helpers/common';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { AccessControl } from '../typechain/contracts/AccessControl';

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
  data: string;
}

const feeds: Feed[] = [
  {
    id: 1n,
    round: 6n,
    stride: 1n,
    data: '0x12343267643573',
  },
  {
    id: 2n,
    round: 5n,
    stride: 0n,
    data: '0x2456',
  },
  {
    id: 3n,
    round: 4n,
    stride: 0n,
    data: '0x3678',
  },
  {
    id: 4n,
    round: 3n,
    stride: 0n,
    data: '0x4890',
  },
  {
    id: 5n,
    round: 2n,
    stride: 0n,
    data: '0x5abc',
  },
];

describe('AggregatedDataFeedStore', () => {
  let contract: AggregatedDataFeedStore;
  let accessControl: AccessControl;
  let signers: HardhatEthersSigner[];
  let accessControlOwner: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    sequencer = signers[0];
    accessControlOwner = signers[1];

    accessControl = await deployContract<AccessControl>(
      'AccessControl',
      accessControlOwner.address,
    );

    contract = await deployContract<AggregatedDataFeedStore>(
      'AggregatedDataFeedStore',
      accessControl.target,
    );

    await accessControlOwner.sendTransaction({
      to: accessControl.target,
      data: sequencer.address,
    });
  });

  it('Should get latest round', async () => {
    const writeTx = await sequencer.sendTransaction({
      to: contract.target,
      data: encodeDataWrite(feeds),
    });

    console.log('write gas:', (await writeTx.wait())!.gasUsed);

    for (const feed of feeds) {
      const data = encodeDataRead(ReadOp.GetLatestRound, feed);
      const res = await sequencer.call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(feed.round);
    }
  });

  it('Should get latest data', async () => {
    const writeTx = await sequencer.sendTransaction({
      to: contract.target,
      data: encodeDataWrite(feeds),
    });

    console.log('write gas:', (await writeTx.wait())!.gasUsed);

    for (const feed of feeds) {
      const data = encodeDataRead(ReadOp.GetLatestFeed, feed);
      const res = await sequencer.call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(formatData(feed.data));
    }
  });

  it('Should get historical feed at round', async () => {
    const writeTx = await sequencer.sendTransaction({
      to: contract.target,
      data: encodeDataWrite(feeds),
    });

    console.log('write gas:', (await writeTx.wait())!.gasUsed);

    const updatedFeeds = feeds.map(feed => {
      feed.round++;
      return feed;
    });

    const writeTx2 = await sequencer.sendTransaction({
      to: contract.target,
      data: encodeDataWrite(updatedFeeds),
    });

    console.log('write gas:', (await writeTx2.wait())!.gasUsed);

    for (const feed of feeds) {
      const data = encodeDataRead(ReadOp.GetFeedAtRound, feed);
      const res = await sequencer.call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(formatData(feed.data));
    }

    for (const feed of updatedFeeds) {
      const data = encodeDataRead(ReadOp.GetFeedAtRound, feed);
      const res = await sequencer.call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(formatData(feed.data));
    }
  });

  it('Should get latest feed and round after update', async () => {
    const writeTx = await sequencer.sendTransaction({
      to: contract.target,
      data: encodeDataWrite(feeds),
    });

    console.log('write gas:', (await writeTx.wait())!.gasUsed);

    const updatedFeeds = feeds.map(feed => {
      feed.round++;
      return feed;
    });

    const writeTx2 = await sequencer.sendTransaction({
      to: contract.target,
      data: encodeDataWrite(updatedFeeds),
    });

    console.log('write gas:', (await writeTx2.wait())!.gasUsed);

    for (const feed of updatedFeeds) {
      const data = encodeDataRead(ReadOp.GetLatestFeedAndRound, feed);
      const res = await sequencer.call({
        to: contract.target,
        data,
      });
      expect(res).to.be.equal(
        ethers.toBeHex(feed.round, 32).concat(formatData(feed.data).slice(2)),
      );
    }
  });

  it('Should revert on write when not in access control', async () => {
    await expect(
      signers[2].sendTransaction({
        to: contract.target,
        data: encodeDataWrite(feeds),
      }),
    ).to.be.reverted;
  });
});

const encodeDataWrite = (feeds: Feed[]) => {
  const blockNumber = Date.now() + 100;
  const prefix = ethers.solidityPacked(
    ['bytes1', 'uint64', 'uint32'],
    ['0x00', blockNumber, feeds.length],
  );

  const data = feeds.map(feed => {
    const index = (feed.id * 2n ** 13n + feed.round) * 2n ** feed.stride;
    const indexInBytesLength = Math.ceil(index.toString(2).length / 8);
    const bytes = (feed.data.length - 2) / 2;
    const bytesLength = Math.ceil(bytes.toString(2).length / 8);

    return ethers
      .solidityPacked(
        [
          'uint8',
          'uint8',
          `uint${8n * BigInt(indexInBytesLength)}`,
          'uint8',
          `uint${8n * BigInt(bytesLength)}`,
          'bytes',
        ],
        [feed.stride, indexInBytesLength, index, bytesLength, bytes, feed.data],
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

  const roundData = Object.keys(batchFeeds)
    .map(index => {
      const indexInBytesLength = Math.ceil(
        BigInt(index).toString(2).length / 8,
      );

      return ethers
        .solidityPacked(
          ['uint8', `uint${8n * BigInt(indexInBytesLength)}`, 'bytes32'],
          [indexInBytesLength, BigInt(index), batchFeeds[index]],
        )
        .slice(2);
    })
    .join('');

  return prefix.concat(data.join('')).concat(roundData);
};

const encodeDataRead = (operation: ReadOp, feed: Feed) => {
  const feedIdInBytesLength = Math.ceil(feed.id.toString(2).length / 4);
  const prefix = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint8', `uint${8n * BigInt(feedIdInBytesLength)}`],
    [operation, feed.stride, feedIdInBytesLength, feed.id],
  );
  const slots = Math.ceil((feed.data.length - 2) / 64);

  if (operation === ReadOp.GetFeedAtRound) {
    return prefix.concat(
      ethers.solidityPacked(['uint16', 'uint32'], [feed.round, slots]).slice(2),
    );
  }

  if (
    operation === ReadOp.GetLatestFeed ||
    operation === ReadOp.GetLatestFeedAndRound
  ) {
    return prefix.concat(ethers.solidityPacked(['uint32'], [slots]).slice(2));
  }

  return prefix;
};

const formatData = (data: string) => {
  const slots = Math.ceil((data.length - 2) / 64);
  return '0x' + data.slice(2).padStart(slots * 64, '0');
};
