import { expect } from 'chai';
import {
  DataFeedV1Consumer,
  DataFeedV2Consumer,
  DataFeedGenericV1Consumer,
  DataFeedGenericV2Consumer,
} from '../../../typechain';
import {
  DataFeedStore,
  GenericDataFeedStore,
  checkGenericSetValues,
  checkSetValues,
  printGasUsage,
  setDataFeeds,
} from './common';
import { contractVersionLogger } from '../logger';

export type DataFeedConsumer = DataFeedV1Consumer | DataFeedV2Consumer;
export type GenericDataFeedConsumer =
  | DataFeedGenericV1Consumer
  | DataFeedGenericV2Consumer;

export const compareConsumerGasUsed = async (
  versionedLogger: ReturnType<typeof contractVersionLogger>,
  dataFeedGenericConsumers: GenericDataFeedConsumer[],
  dataFeedConsumers: DataFeedConsumer[],
  genericContracts: GenericDataFeedStore[],
  contracts: DataFeedStore[],
  selector: string,
  valuesCount: number,
  start: number = 0,
) => {
  const { keys, values } = await setDataFeeds(
    genericContracts,
    contracts,
    selector,
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
    for (const contract of dataFeedConsumers) {
      const value = await contract.getFeedById(keys[i]);
      const externalValue = await contract.getExternalFeedById(keys[i]);
      expect(value).to.be.equal(values[i]);
      expect(externalValue).to.be.equal(values[i]);
    }

    for (const contract of dataFeedGenericConsumers) {
      const value = await contract.getFeedById(keys[i]);
      const externalValue = await contract.getExternalFeedById(keys[i]);
      expect(value).to.be.equal(values[i]);
      expect(externalValue).to.be.equal(values[i]);
    }
  }

  await checkSetValues(contracts, versionedLogger, keys, values);
  await checkGenericSetValues(genericContracts, keys, values);

  await printGasUsage(versionedLogger, receipts, receiptsGeneric);

  for (const receipt of receipts) {
    for (const receiptGeneric of receiptsGeneric) {
      expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
    }
  }
};
