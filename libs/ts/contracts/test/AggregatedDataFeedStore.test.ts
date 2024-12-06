import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Feed } from './utils/wrappers/types';
import { ADFSWrapper } from './utils/wrappers';

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
  let contract: ADFSWrapper;
  let signers: HardhatEthersSigner[];
  let accessControlOwner: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    sequencer = signers[0];
    accessControlOwner = signers[1];

    contract = new ADFSWrapper();
    await contract.init(accessControlOwner);
    await contract.accessControl.set(accessControlOwner, [sequencer.address]);
  });

  it('Should get latest round', async () => {
    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestRound(sequencer, feeds);
  });

  it('Should get latest data', async () => {
    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestValue(sequencer, feeds);
  });

  it('Should get historical feed at round', async () => {
    await contract.setFeeds(sequencer, feeds);

    const updatedFeeds = feeds.map(feed => {
      feed.round++;
      return feed;
    });

    await contract.setFeeds(sequencer, updatedFeeds);

    await contract.checkValueAtRound(sequencer, feeds);
    await contract.checkValueAtRound(sequencer, updatedFeeds);
  });

  it('Should get latest feed and round after update', async () => {
    await contract.setFeeds(sequencer, feeds);

    const updatedFeeds = feeds.map(feed => {
      feed.round++;
      return feed;
    });

    await contract.setFeeds(sequencer, updatedFeeds);
    await contract.checkLatestFeedAndRound(sequencer, feeds);
  });

  it('Should revert on write when not in access control', async () => {
    await expect(contract.setFeeds(signers[2], feeds)).to.be.reverted;
  });

  it('Should revert if blockNumber same as previous block', async () => {
    const blockNumber = 1;
    const prefix = ethers.solidityPacked(
      ['bytes1', 'uint64', 'uint32'],
      ['0x00', blockNumber, 0],
    );
    await contract.setFeeds(sequencer, feeds, prefix);

    await expect(contract.setFeeds(sequencer, feeds, prefix)).to.be.reverted;
  });

  it('Should revert when stride is bigger than 31', async () => {
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 1n,
          round: 1n,
          stride: 32n,
          data: '0x12343267643573',
        },
      ]),
    ).to.be.reverted;
  });

  it('Should revert when round table index is bigger than 2**116', async () => {
    const feed = {
      id: 1n,
      round: 1n,
      stride: 31n,
      data: '0x12343267643573',
    };

    let data = contract.encodeDataWrite([feed]);

    const roundTableIndex = ethers.toBeHex(
      (2n ** 115n * feed.stride + feed.id) / 16n,
    );
    const maxRoundTableIndex = ethers.toBeHex(2n ** 116n);
    data = data.replace(roundTableIndex.slice(2), maxRoundTableIndex.slice(2));
    await sequencer.sendTransaction({
      to: contract.contract.target,
      data,
    });

    const overflowRoundTableIndex = ethers.toBeHex(2n ** 116n + 1n);
    data = data.replace(
      maxRoundTableIndex.slice(2),
      overflowRoundTableIndex.slice(2),
    );

    await expect(
      sequencer.sendTransaction({
        to: contract.contract.target,
        data,
      }),
    ).to.be.reverted;
  });
});
