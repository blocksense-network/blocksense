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
    index: 6n,
    stride: 1n,
    data: '0x12343267643573',
    slotsToRead: 1,
  },
  {
    id: 2n,
    index: 5n,
    stride: 0n,
    data: '0x2456',
  },
  {
    id: 3n,
    index: 4n,
    stride: 0n,
    data: '0x3678',
  },
  {
    id: 4n,
    index: 3n,
    stride: 0n,
    data: '0x4890',
  },
  {
    id: 5n,
    index: 2n,
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
    const destinationAccumulator = ethers.toBeHex(1, 32);
    const res = await contract.setFeeds(sequencer, feeds, {
      destinationAccumulator,
    });
    const receipt = await res.tx.wait();
    contract.checkEvent(receipt!, destinationAccumulator);
  });

  it('Should get latest index', async () => {
    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestIndex(sequencer, feeds);
  });

  it('Should get latest single feed data', async () => {
    const stride0Feeds = feeds.filter(feed => feed.stride === 0n);
    await contract.setFeeds(sequencer, stride0Feeds);
    const res = await contract.getValues(sequencer, stride0Feeds, {
      operations: stride0Feeds.map(() => ReadOp.GetLatestSingleData),
    });

    for (const [i, feed] of stride0Feeds.entries()) {
      expect(res[i]).to.equal(contract.formatData(feed));
    }
  });

  it('Should get latest data', async () => {
    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestData(sequencer, feeds);
  });

  it('Should get historical feed at index', async () => {
    const res = await contract.setFeeds(sequencer, feeds);

    const updatedFeeds = feeds.map(feed => {
      return {
        ...feed,
        index: feed.index + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds, {
      sourceAccumulator: res.destinationAccumulator,
      destinationAccumulator: ethers.toBeHex(101, 32),
    });

    await contract.checkDataAtIndex(sequencer, feeds);
    await contract.checkDataAtIndex(sequencer, updatedFeeds);
  });

  it('Should get latest single feed and index after update', async () => {
    const stride0Feeds = feeds.filter(feed => feed.stride === 0n);
    const res = await contract.setFeeds(sequencer, stride0Feeds);

    const updatedFeeds = stride0Feeds.map(feed => {
      return {
        ...feed,
        index: feed.index + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds, {
      sourceAccumulator: res.destinationAccumulator,
      destinationAccumulator: ethers.toBeHex(101, 32),
    });
    const values = await contract.getValues(sequencer, stride0Feeds, {
      operations: stride0Feeds.map(() => ReadOp.GetLatestSingleDataAndIndex),
    });

    for (const [i, feed] of updatedFeeds.entries()) {
      expect(values[i]).to.equal(
        ethers
          .toBeHex(feed.index, 32)
          .concat(contract.formatData(feed).slice(2)),
      );
    }
  });

  it('Should get latest feed and index after update', async () => {
    const res = await contract.setFeeds(sequencer, feeds);

    const updatedFeeds = feeds.map(feed => {
      return {
        ...feed,
        index: feed.index + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds, {
      sourceAccumulator: res.destinationAccumulator,
      destinationAccumulator: ethers.toBeHex(101, 32),
    });
    await contract.checkLatestDataAndIndex(sequencer, updatedFeeds);
  });

  it('Should revert on write when not in access control', async () => {
    await expect(contract.setFeeds(signers[2], feeds)).to.be.reverted;
  });

  it('Should revert if source history accumulator is different from the stored', async () => {
    const sourceAccumulator = ethers.toBeHex(100, 32);
    // set history accumulator for the first time (0 -> 100)
    await contract.setFeeds(sequencer, feeds, {
      destinationAccumulator: sourceAccumulator,
    });

    await expect(
      contract.setFeeds(sequencer, feeds, {
        sourceAccumulator: ethers.toBeHex(101, 32),
      }),
    ).to.be.reverted;
  });

  it('[W] Should revert when stride is bigger than max stride (31)', async () => {
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 1n,
          index: 1n,
          stride: 31n,
          data: '0x12343267643573',
        },
      ]),
    ).to.not.be.reverted;

    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 1n,
          index: 1n,
          stride: 32n,
          data: '0x12343267643573',
        },
      ]),
    ).to.be.reverted;
  });

  it('[R] Should revert when id is bigger than max id (2**115 - 1)', async () => {
    const feed: Feed = {
      id: 2n ** 115n - 1n,
      index: 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestData(sequencer, [feed]);
    await contract.checkDataAtIndex(sequencer, [feed]);

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
        { operations: [ReadOp.GetDataAtIndex] },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when stride is bigger than max stride (31)', async () => {
    const feed: Feed = {
      id: 2n,
      index: 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestData(sequencer, [feed]);
    await contract.checkDataAtIndex(sequencer, [feed]);

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
        { operations: [ReadOp.GetDataAtIndex] },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when index is bigger than max index (2**13 - 1)', async () => {
    const feed: Feed = {
      id: 1n,
      index: 2n ** 13n - 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkDataAtIndex(sequencer, [feed]);

    await expect(
      contract.getValues(
        sequencer,
        [
          {
            id: 1n,
            index: 2n ** 13n,
            stride: 31n,
            slotsToRead: 1,
          },
        ],
        {
          operations: [ReadOp.GetDataAtIndex],
        },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when slots to read exceed feed space', async () => {
    const feed = {
      id: 5000000000000n,
      index: 2n ** 13n - 1n,
      stride: 3n,
      data: ethers.hexlify(ethers.randomBytes(32)),
      slotsToRead: 8,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestData(sequencer, [feed]);
    await contract.checkDataAtIndex(sequencer, [feed]);

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
          operations: [ReadOp.GetDataAtIndex],
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
          operations: [ReadOp.GetLatestData],
        },
      ),
    ).to.be.reverted;
  });

  it('[W] Should revert when index is outside of stride space', async () => {
    // index is exceeded
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n - 1n,
          index: 2n ** 13n,
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
          index: 2n,
          stride: 0n,
          data: '0x12343267643573',
        },
      ]),
    ).to.be.reverted;

    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n - 1n,
          index: 2n ** 13n - 1n,
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
          index: 2n ** 13n - 1n,
          stride: 0n,
          data: ethers.hexlify(ethers.randomBytes(33)),
        },
      ]),
    ).to.be.reverted;
  });

  it('[W] Should revert when index table index is bigger than 2**116', async () => {
    const feed = {
      id: 2n ** 115n - 1n,
      index: 1n,
      stride: 31n,
      data: '0x12343267643573',
    };

    let res = contract.encodeDataWrite([feed]);
    let data = res.data;

    const indexTableIndex = ethers.toBeHex(
      (2n ** 115n * feed.stride + feed.id) / 16n,
    );
    const maxIndexTableIndex = ethers.toBeHex(2n ** 116n - 1n);
    data = data.replace(indexTableIndex.slice(2), maxIndexTableIndex.slice(2));
    await expect(
      sequencer.sendTransaction({
        to: contract.contract.target,
        data,
      }),
    ).to.not.be.reverted;

    const overflowIndexTableIndex = ethers.toBeHex(2n ** 116n);
    data = data.replace(
      maxIndexTableIndex.slice(2),
      overflowIndexTableIndex.slice(2),
    );

    // change history accumulator
    data = data.replace(
      res.destinationAccumulator.slice(2),
      ethers.toBeHex(0, 32).slice(2),
    );
    data = data.replace(
      res.sourceAccumulator.slice(2),
      res.destinationAccumulator.slice(2),
    );

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
    await contract.checkLatestDataAndIndex(sequencer, feeds);
  });

  describe('Compare gas usage', function () {
    let contractWrappers: HistoricalDataFeedStoreBaseWrapper[] = [];
    let genericContractWrappers: HistoricalDataFeedStoreGenericBaseWrapper[] =
      [];

    let genericContract: ADFSGenericWrapper;

    const historyAccumulator = ethers.toBeHex(1234, 32);
    const newHistoryAccumulator = ethers.toBeHex(12345, 32);

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

      // store no data first time in ADFS to avoid first sstore of history accumulator
      await contract.setFeeds(sequencer, [], {
        destinationAccumulator: historyAccumulator,
      });
      await genericContract.setFeeds(sequencer, [], {
        destinationAccumulator: historyAccumulator,
      });
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
          historyAccumulator,
          newHistoryAccumulator,
          {
            index: 1n,
          },
        );

        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          newHistoryAccumulator,
          ethers.toBeHex(123456, 32),
          {
            index: 2n,
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
          historyAccumulator,
          newHistoryAccumulator,
          {
            skip: 16,
            index: 1n,
          },
        );

        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          newHistoryAccumulator,
          ethers.toBeHex(123456, 32),
          {
            skip: 16,
            index: 2n,
          },
        );
      });
    }
  });
});
