import { ethers } from 'hardhat';
import { expect } from 'chai';
import { initConsumerWrappers } from './utils/helpers/common';
import { compareConsumerGasUsed } from './utils/helpers/consumerGasHelpers';
import {
  DataFeedStoreConsumerBaseWrapper,
  DataFeedStoreConsumerV1Wrapper,
  DataFeedStoreConsumerV2Wrapper,
  DataFeedStoreConsumerV3Wrapper,
  DataFeedStoreGenericConsumerV1Wrapper,
  DataFeedStoreGenericConsumerV2Wrapper,
} from './utils/wrappers';

let contractWrappers: DataFeedStoreConsumerBaseWrapper[] = [];
let genericContractWrappers: DataFeedStoreConsumerBaseWrapper[] = [];

describe('DataFeedConsumer', function () {
  this.timeout(100000);

  beforeEach(async function () {
    contractWrappers = [];
    genericContractWrappers = [];

    await initConsumerWrappers(contractWrappers, [
      DataFeedStoreConsumerV1Wrapper,
      DataFeedStoreConsumerV2Wrapper,
      DataFeedStoreConsumerV3Wrapper,
    ]);

    await initConsumerWrappers(genericContractWrappers, [
      DataFeedStoreGenericConsumerV1Wrapper,
      DataFeedStoreGenericConsumerV2Wrapper,
    ]);
  });

  for (let i = 0; i < 3; i++) {
    describe(`DataFeedStoreV${i + 1}`, function () {
      it('Should read the data feed with the fallback function', async function () {
        const key = 3;
        const value = ethers.solidityPacked(
          ['bytes32'],
          [ethers.zeroPadBytes(ethers.toUtf8Bytes('Hello, World!'), 32)],
        );
        await contractWrappers[i].wrapper.setFeeds([key], [value]);

        const feed = await contractWrappers[i].getExternalFeedById(key);
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
