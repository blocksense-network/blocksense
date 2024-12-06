import { ethers } from 'hardhat';
import { initWrappers } from './utils/helpers/common';
import { compareGasUsed } from './utils/helpers/dataFeedGasHelpers';
import {
  HistoricalDataFeedStoreBaseWrapper,
  HistoricalDataFeedStoreGenericBaseWrapper,
  HistoricalDataFeedStoreV1Wrapper,
  HistoricalDataFeedStoreGenericV1Wrapper,
  HistoricalDataFeedStoreV2Wrapper,
} from './utils/wrappers';

let contractWrappers: HistoricalDataFeedStoreBaseWrapper[] = [];
let genericContractWrappers: HistoricalDataFeedStoreGenericBaseWrapper[] = [];

describe('HistoricalDataFeedStore', function () {
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
  });

  for (let i = 0; i < 2; i++) {
    describe(`HistoricalDataFeedStoreV${i + 1}`, function () {
      this.timeout(1000000);

      it('Should set and get correct values', async function () {
        const key = 1;
        const value = ethers.encodeBytes32String('value');

        const receipt = await contractWrappers[i].setFeeds([key], [value]);

        await contractWrappers[i].checkSetValues([key], [value]);
        await contractWrappers[i].checkSetTimestamps(
          [key],
          [receipt.blockNumber],
        );
      });

      it('Should get the current counter', async function () {
        const key = 1;
        const value = ethers.encodeBytes32String('value');

        await contractWrappers[i].setFeeds([key], [value]);
        await contractWrappers[i].checkLatestCounter(key, 1);
      });

      it('Should get the current counter after 10 iterations', async function () {
        const key = 1;
        const value = ethers.encodeBytes32String('value');

        for (let j = 0; j < 10; j++) {
          await contractWrappers[i].setFeeds([key], [value]);
        }

        await contractWrappers[i].checkLatestCounter(key, 10);
      });

      it('Should get value at counter 5', async function () {
        const key = 1;
        const counter = 5;
        let blockNumber = 0;

        for (let j = 1; j <= 10; j++) {
          const value = ethers.encodeBytes32String('value ' + j);
          const receipt = await contractWrappers[i].setFeeds([key], [value]);
          if (j === counter) {
            blockNumber = receipt.blockNumber;
          }
        }
        await contractWrappers[i].checkValueAtCounter(
          key,
          counter,
          ethers.encodeBytes32String('value ' + counter),
          blockNumber,
        );
      });
    });
  }

  for (let i = 1; i <= 100; i *= 10) {
    it(`Should set ${i} feeds in a single transaction`, async function () {
      await compareGasUsed(genericContractWrappers, contractWrappers, i);
      const { keys, values, receipts, receiptsGeneric } = await compareGasUsed(
        genericContractWrappers,
        contractWrappers,
        i,
      );

      for (const [i, key] of keys.entries()) {
        for (const [j, wrapper] of contractWrappers.entries()) {
          await wrapper.checkLatestCounter(key, 2);
          await wrapper.checkSetTimestamps([key], [receipts[j].blockNumber]);
          await wrapper.checkValueAtCounter(
            key,
            2,
            values[i],
            receipts[j].blockNumber,
          );
        }

        for (const [j, wrapper] of genericContractWrappers.entries()) {
          await wrapper.checkLatestCounter(key, 2);
          await wrapper.checkSetTimestamps(
            [key],
            [receiptsGeneric[j].blockNumber],
          );
          await wrapper.checkValueAtCounter(
            key,
            2,
            values[i],
            receiptsGeneric[j].blockNumber,
          );
        }
      }
    });
  }
});
