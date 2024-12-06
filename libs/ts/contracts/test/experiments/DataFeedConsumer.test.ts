import { ethers } from 'hardhat';
import { expect } from 'chai';
import {
  DataFeed,
  GenericDataFeedStore,
  initWrappers,
} from './utils/helpers/common';
import { compareConsumerGasUsed } from './utils/helpers/consumerGasHelpers';
import {
  DataFeedStoreConsumerBaseWrapper,
  DataFeedStoreConsumerV1Wrapper,
  DataFeedStoreConsumerV2Wrapper,
  DataFeedStoreConsumerV3Wrapper,
  DataFeedStoreGenericConsumerV1Wrapper,
  DataFeedStoreGenericConsumerV2Wrapper,
} from './utils/wrappers';

let contractWrappers: DataFeedStoreConsumerBaseWrapper<DataFeed>[] = [];
let genericContractWrappers: DataFeedStoreConsumerBaseWrapper<GenericDataFeedStore>[] =
  [];

describe('DataFeedConsumer', function () {
  this.timeout(1000000);

  beforeEach(async function () {
    contractWrappers = [];
    genericContractWrappers = [];

    await initWrappers(contractWrappers, [
      DataFeedStoreConsumerV1Wrapper,
      DataFeedStoreConsumerV2Wrapper,
      DataFeedStoreConsumerV3Wrapper,
    ]);

    await initWrappers(genericContractWrappers, [
      DataFeedStoreGenericConsumerV1Wrapper,
      DataFeedStoreGenericConsumerV2Wrapper,
    ]);
  });

  for (let i = 0; i < 3; i++) {
    describe(`DataFeedStoreV${i + 1}`, function () {
      it('Should read the data feed with the fallback function', async function () {
        const key = 3;
        const value = ethers.encodeBytes32String('Hello, World!');

        await contractWrappers[i].setFeeds([key], [value]);
        await contractWrappers[i].setMultipleFetchedFeedsById([key]);

        const feed = await contractWrappers[i].getFeedById(key);
        expect(feed).to.equal(value);
      });
    });
  }

  for (let i = 1; i <= 1000; i *= 10) {
    it(`Should fetch and set ${i} feeds in a single transaction`, async function () {
      await compareConsumerGasUsed(
        genericContractWrappers,
        contractWrappers,
        i,
      );
    });
  }
});
