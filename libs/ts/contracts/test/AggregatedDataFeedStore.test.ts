import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Feed, ReadOp } from './utils/wrappers/types';
import { ADFSGenericWrapper, ADFSWrapper } from './utils/wrappers';
import {
  HistoricalDataFeedStoreBaseWrapper,
  HistoricalDataFeedStoreGenericBaseWrapper,
  HistoricalDataFeedStoreGenericV1Wrapper,
  HistoricalDataFeedStoreV1Wrapper,
  HistoricalDataFeedStoreV2Wrapper,
} from './experiments/utils/wrappers';
import { initWrappers } from './experiments/utils/helpers/common';
import { compareGasUsed } from './utils/helpers/compareGasWithExperiments';
import { generateRandomFeeds } from './utils/helpers/common';

const feeds: Feed[] = [
  {
    id: 1n,
    round: 6n,
    stride: 1n,
    data: '0x12343267643573',
    slotsToRead: 1,
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
    await contract.accessControl.setAdminStates(
      accessControlOwner,
      [sequencer.address],
      [true],
    );
  });

  it('Should emit event when data feeds updated', async () => {
    const blockNumber = 1234;
    const tx = await contract.setFeeds(sequencer, feeds, {
      blockNumber,
    });
    const receipt = await tx.wait();
    contract.checkEvent(receipt!, blockNumber);
  });

  it('Should get latest round', async () => {
    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestRound(sequencer, feeds);
  });

  it('Should get latest single feed data', async () => {
    const stride0Feeds = feeds.filter(feed => feed.stride === 0n);
    await contract.setFeeds(sequencer, stride0Feeds);
    const res = await contract.getValues(sequencer, stride0Feeds, {
      operations: stride0Feeds.map(() => ReadOp.GetLatestSingleFeed),
    });

    for (const [i, feed] of stride0Feeds.entries()) {
      expect(res[i]).to.equal(contract.formatData(feed));
    }
  });

  it('Should get latest data', async () => {
    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestValue(sequencer, feeds);
  });

  it('Should get historical feed at round', async () => {
    await contract.setFeeds(sequencer, feeds);

    const updatedFeeds = feeds.map(feed => {
      return {
        ...feed,
        round: feed.round + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds);

    await contract.checkValueAtRound(sequencer, feeds);
    await contract.checkValueAtRound(sequencer, updatedFeeds);
  });

  it('Should get latest single feed and round after update', async () => {
    const stride0Feeds = feeds.filter(feed => feed.stride === 0n);
    await contract.setFeeds(sequencer, stride0Feeds);

    const updatedFeeds = stride0Feeds.map(feed => {
      return {
        ...feed,
        round: feed.round + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds);
    const res = await contract.getValues(sequencer, stride0Feeds, {
      operations: stride0Feeds.map(() => ReadOp.GetLatestSingleFeedAndRound),
    });

    for (const [i, feed] of updatedFeeds.entries()) {
      expect(res[i]).to.equal(
        ethers
          .toBeHex(feed.round, 32)
          .concat(contract.formatData(feed).slice(2)),
      );
    }
  });

  it('Should get latest feed and round after update', async () => {
    await contract.setFeeds(sequencer, feeds);

    const updatedFeeds = feeds.map(feed => {
      return {
        ...feed,
        round: feed.round + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds);
    await contract.checkLatestFeedAndRound(sequencer, updatedFeeds);
  });

  it('Should revert on write when not in access control', async () => {
    await expect(contract.setFeeds(signers[2], feeds)).to.be.reverted;
  });

  it('Should revert if blockNumber same as previous block', async () => {
    const blockNumber = 1;
    await contract.setFeeds(sequencer, feeds, { blockNumber });

    await expect(contract.setFeeds(sequencer, feeds, { blockNumber })).to.be
      .reverted;
  });

  it('Should revert if blockNumber lower than previous block', async () => {
    const blockNumber = 1;
    await contract.setFeeds(sequencer, feeds, { blockNumber });

    await expect(
      contract.setFeeds(sequencer, feeds, { blockNumber: blockNumber - 1 }),
    ).to.be.reverted;
  });

  it('[W] Should revert when stride is bigger than max stride (31)', async () => {
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 1n,
          round: 1n,
          stride: 31n,
          data: '0x12343267643573',
        },
      ]),
    ).to.not.be.reverted;

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

  it('[R] Should revert when id is bigger than max id (2**115 - 1)', async () => {
    const feed: Feed = {
      id: 2n ** 115n - 1n,
      round: 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestValue(sequencer, [feed]);
    await contract.checkValueAtRound(sequencer, [feed]);

    await expect(
      contract.getValues(sequencer, [
        {
          ...feed,
          id: feed.id + 1n,
        },
      ]),
    ).to.be.reverted;
    await expect(
      contract.getValues(
        sequencer,
        [
          {
            ...feed,
            id: feed.id + 1n,
          },
        ],
        { operations: [ReadOp.GetFeedAtRound] },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when stride is bigger than max stride (31)', async () => {
    const feed: Feed = {
      id: 2n,
      round: 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestValue(sequencer, [feed]);
    await contract.checkValueAtRound(sequencer, [feed]);

    await expect(
      contract.getValues(sequencer, [
        {
          ...feed,
          stride: 32n,
        },
      ]),
    ).to.be.reverted;
    await expect(
      contract.getValues(
        sequencer,
        [
          {
            ...feed,
            stride: 32n,
          },
        ],
        { operations: [ReadOp.GetFeedAtRound] },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when round is bigger than max round (2**13 - 1)', async () => {
    const feed: Feed = {
      id: 1n,
      round: 2n ** 13n - 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkValueAtRound(sequencer, [feed]);

    await expect(
      contract.getValues(
        sequencer,
        [
          {
            id: 1n,
            round: 2n ** 13n,
            stride: 31n,
            slotsToRead: 1,
          },
        ],
        {
          operations: [ReadOp.GetFeedAtRound],
        },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when slots to read exceed feed space', async () => {
    const feed = {
      id: 5000000000000n,
      round: 2n ** 13n - 1n,
      stride: 3n,
      data: ethers.hexlify(ethers.randomBytes(32)),
      slotsToRead: 8,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestValue(sequencer, [feed]);
    await contract.checkValueAtRound(sequencer, [feed]);

    await expect(
      contract.getValues(
        sequencer,
        [
          {
            ...feed,
            slotsToRead: feed.slotsToRead + 1,
          },
        ],
        {
          operations: [ReadOp.GetFeedAtRound],
        },
      ),
    ).to.be.reverted;
    await expect(
      contract.getValues(
        sequencer,
        [
          {
            ...feed,
            slotsToRead: feed.slotsToRead + 1,
          },
        ],
        {
          operations: [ReadOp.GetLatestFeed],
        },
      ),
    ).to.be.reverted;
  });

  it('[W] Should revert when index is outside of stride space', async () => {
    // round is exceeded
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n - 1n,
          round: 2n ** 13n,
          stride: 0n,
          data: '0x12343267643573',
        },
      ]),
    ).to.be.reverted;

    // id is exceeded
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n,
          round: 2n,
          stride: 0n,
          data: '0x12343267643573',
        },
      ]),
    ).to.be.reverted;

    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n - 1n,
          round: 2n ** 13n - 1n,
          stride: 0n,
          data: ethers.hexlify(ethers.randomBytes(32)),
        },
      ]),
    ).to.not.be.reverted;

    // bytes to write exceeds stride space
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n - 1n,
          round: 2n ** 13n - 1n,
          stride: 0n,
          data: ethers.hexlify(ethers.randomBytes(33)),
        },
      ]),
    ).to.be.reverted;
  });

  it('[W] Should revert when round table index is bigger than 2**116', async () => {
    const feed = {
      id: 2n ** 115n - 1n,
      round: 1n,
      stride: 31n,
      data: '0x12343267643573',
    };

    let data = contract.encodeDataWrite([feed]);

    const roundTableIndex = ethers.toBeHex(
      (2n ** 115n * feed.stride + feed.id) / 16n,
    );
    const maxRoundTableIndex = ethers.toBeHex(2n ** 116n - 1n);
    data = data.replace(roundTableIndex.slice(2), maxRoundTableIndex.slice(2));
    await expect(
      sequencer.sendTransaction({
        to: contract.contract.target,
        data,
      }),
    ).to.not.be.reverted;

    const overflowRoundTableIndex = ethers.toBeHex(2n ** 116n);
    data = data.replace(
      maxRoundTableIndex.slice(2),
      overflowRoundTableIndex.slice(2),
    );

    // change blocknumber
    const newPrefix = contract.encodeDataWrite([]);
    data = data.replace(data.slice(2, 20), newPrefix.slice(2, 20));

    await expect(
      sequencer.sendTransaction({
        to: contract.contract.target,
        data,
      }),
    ).to.be.reverted;
  });

  it('Should read from contract multiple slots', async () => {
    const feeds = generateRandomFeeds(15);

    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestFeedAndRound(sequencer, feeds);
  });

  describe('Compare gas usage', function () {
    let contractWrappers: HistoricalDataFeedStoreBaseWrapper[] = [];
    let genericContractWrappers: HistoricalDataFeedStoreGenericBaseWrapper[] =
      [];

    let genericContract: ADFSGenericWrapper;

    beforeEach(async function () {
      contractWrappers = [];
      genericContractWrappers = [];

      await initWrappers(contractWrappers, [
        HistoricalDataFeedStoreV1Wrapper,
        HistoricalDataFeedStoreV2Wrapper,
      ]);

      await initWrappers(genericContractWrappers, [
        HistoricalDataFeedStoreGenericV1Wrapper,
      ]);

      genericContract = new ADFSGenericWrapper();
      await genericContract.init(accessControlOwner);
      await genericContract.accessControl.setAdminStates(
        accessControlOwner,
        [sequencer.address],
        [true],
      );

      contract = new ADFSWrapper();
      await contract.init(accessControlOwner);
      await contract.accessControl.setAdminStates(
        accessControlOwner,
        [sequencer.address],
        [true],
      );

      // store no data first time in ADFS to avoid first sstore of blocknumber
      await contract.setFeeds(sequencer, []);
      await genericContract.setFeeds(sequencer, []);
    });

    for (let i = 1; i <= 100; i *= 10) {
      it(`Should set ${i} data feeds consecutively`, async function () {
        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          {
            round: 1n,
          },
        );

        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          {
            round: 2n,
          },
        );
      });

      it(`Should set ${i} data feeds every 16 id`, async function () {
        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          {
            skip: 16,
            round: 1n,
          },
        );

        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          {
            skip: 16,
            round: 2n,
          },
        );
      });
    }
  });
});
