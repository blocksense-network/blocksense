import { expect } from 'chai';
import {
  DataFeedV1Consumer,
  DataFeedV2Consumer,
  DataFeedGenericV1Consumer,
  DataFeedGenericV2Consumer,
} from '../../../typechain';
import { printGasUsage, setDataFeeds } from './common';
import { DataFeedStoreConsumerBaseWrapper } from '../wrappers';

export type DataFeedConsumer = DataFeedV1Consumer | DataFeedV2Consumer;
export type GenericDataFeedConsumer =
  | DataFeedGenericV1Consumer
  | DataFeedGenericV2Consumer;

export const compareConsumerGasUsed = async (
  dataFeedGenericConsumers: DataFeedStoreConsumerBaseWrapper[],
  dataFeedConsumers: DataFeedStoreConsumerBaseWrapper[],
  valuesCount: number,
  start: number = 0,
) => {
  const { keys, values } = await setDataFeeds(
    dataFeedGenericConsumers.map(c => c.wrapper),
    dataFeedConsumers.map(c => c.wrapper),
    valuesCount,
    start,
  );

  const receipts = [];
  for (const consumer of dataFeedConsumers) {
    const receipt = await consumer.setMultipleFetchedFeedsById(keys);

    receipts.push(await receipt.wait());
  }

  const receiptsGeneric = [];
  for (const consumer of dataFeedGenericConsumers) {
    const receipt = await consumer.setMultipleFetchedFeedsById(keys);

    receiptsGeneric.push(await receipt.wait());
  }

  for (let i = 0; i < keys.length; i++) {
    for (const consumer of [
      ...dataFeedConsumers,
      ...dataFeedGenericConsumers,
    ]) {
      await consumer.checkSetValues([keys[i]], [values[i]]);
    }
  }

  await printGasUsage(
    dataFeedGenericConsumers,
    dataFeedConsumers,
    receipts,
    receiptsGeneric,
  );

  for (const receipt of receipts) {
    for (const receiptGeneric of receiptsGeneric) {
      expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
    }
  }
};
