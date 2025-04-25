import { ethers } from 'hardhat';
import { expect } from 'chai';
import {
  GenericHistoricalDataFeedStore,
  HistoricalDataFeedStore,
  initWrappers,
  printGasUsage,
  setDataFeeds,
} from './utils/helpers/common';
import {
  HistoricalDataFeedStoreConsumerBaseWrapper,
  HistoricalDataFeedStoreConsumerV1Wrapper,
  HistoricalDataFeedStoreConsumerV2Wrapper,
  HistoricalDataFeedStoreGenericConsumerV1Wrapper,
} from './utils/wrappers';
import { compareConsumerGasUsed } from './utils/helpers/consumerGasHelpers';

let contractWrappers: HistoricalDataFeedStoreConsumerBaseWrapper<HistoricalDataFeedStore>[] =
  [];
let genericContractWrappers: HistoricalDataFeedStoreConsumerBaseWrapper<GenericHistoricalDataFeedStore>[] =
  [];

describe('HistoricalDataFeedConsumer', function () {
  this.timeout(100000);

  beforeEach(async function () {
    contractWrappers = [];
    genericContractWrappers = [];

    await initWrappers(contractWrappers, [
      HistoricalDataFeedStoreConsumerV1Wrapper,
      HistoricalDataFeedStoreConsumerV2Wrapper,
    ]);

    await initWrappers(genericContractWrappers, [
      HistoricalDataFeedStoreGenericConsumerV1Wrapper,
    ]);
  });

  for (let i = 0; i < 2; i++) {
    describe(`HistoricalDataFeedConsumerV${i + 1}`, function () {
      it('Should set and read the latest data feed and counter with the fallback function', async function () {
        const key = 3;
        const value = ethers.encodeBytes32String('Hello, World!');
        const receipt = await contractWrappers[i].setFeeds([key], [value]);

        await contractWrappers[i].setMultipleFetchedFeedsById([key]);

        await contractWrappers[i].checkSetValues([key], [value]);
        await contractWrappers[i].checkLatestCounter(key, 1);
        await contractWrappers[i].checkSetTimestamps(
          [key],
          [receipt.blockNumber],
        );
      });

      it('Should read the historical data feed and counter with the fallback function', async function () {
        const key = 3;
        const counter = 1;
        const value = ethers.encodeBytes32String('Hello, World!');
        const receipt = await contractWrappers[i].setFeeds([key], [value]);

        const value2 = ethers.encodeBytes32String('Hello, World! 2');
        await contractWrappers[i].setFeeds([key], [value2]);

        await contractWrappers[i].setMultipleFeedsAtCounter([key, key], [1, 2]);

        await contractWrappers[i].checkValueAtCounter(
          key,
          counter,
          value,
          receipt.blockNumber,
        );
      });
    });
  }

  for (let i = 1; i <= 100; i *= 10) {
    it(`Should update ${i} feeds and counters in a single transaction`, async function () {
      await compareConsumerGasUsed(
        genericContractWrappers,
        contractWrappers,
        i,
      );
    });

    it(`Should fetch ${i} feeds at 2 out of 3 counters in a single transaction`, async function () {
      await setDataFeeds(genericContractWrappers, contractWrappers, i);
      const {
        receipts: setReceipts,
        receiptsGeneric: setReceiptsGeneric,
        keys,
        values,
      } = await setDataFeeds(genericContractWrappers, contractWrappers, i);
      await setDataFeeds(genericContractWrappers, contractWrappers, i);

      const receipts = [];
      const receiptsGeneric = [];

      for (const [index, wrapper] of [
        ...contractWrappers,
        ...genericContractWrappers,
      ].entries()) {
        const receipt = await wrapper.setMultipleFeedsAtCounter(
          keys,
          keys.map(_ => 2),
        );

        let setReceipt;
        if (
          wrapper instanceof HistoricalDataFeedStoreGenericConsumerV1Wrapper
        ) {
          setReceipt = setReceiptsGeneric[0];
          receiptsGeneric.push(await receipt.wait());
        } else {
          setReceipt = setReceipts[index];
          receipts.push(await receipt.wait());
        }

        for (let i = 0; i < keys.length; i++) {
          await wrapper.checkValueAtCounter(
            keys[i],
            2,
            values[i],
            setReceipt.blockNumber,
          );
        }
      }

      printGasUsage(
        genericContractWrappers,
        contractWrappers,
        receipts,
        receiptsGeneric,
      );

      for (const receipt of receipts) {
        for (const genericReceipt of receiptsGeneric) {
          expect(receipt?.gasUsed).to.be.lte(genericReceipt?.gasUsed);
        }
      }
    });
  }
});
