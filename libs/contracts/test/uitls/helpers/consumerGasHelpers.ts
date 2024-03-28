import { expect } from 'chai';
import {
  DataFeedV1Consumer,
  DataFeedV2Consumer,
  DataFeedGenericConsumer,
  DataFeedGenericV2Consumer,
} from '../../../typechain';
import { DataFeedStore, IGenericDataFeedStore, setDataFeeds } from '.';
import { contractVersionLogger } from '../logger';

export type DataFeedConsumers = DataFeedV1Consumer | DataFeedV2Consumer;
export type DataFeedGenericConsumers =
  | DataFeedGenericConsumer
  | DataFeedGenericV2Consumer;

function isGenericV1Consumer(
  contract: DataFeedGenericConsumer | DataFeedGenericV2Consumer,
): contract is DataFeedGenericConsumer {
  return (contract as DataFeedGenericConsumer).interface.hasFunction(
    'dataFeedStore',
  );
}

export const compareConsumerGasUsed = async (
  versionedLogger: ReturnType<typeof contractVersionLogger>,
  dataFeedGenericConsumers: DataFeedGenericConsumers[],
  dataFeedConsumers: DataFeedConsumers[],
  genericContracts: IGenericDataFeedStore[],
  contracts: DataFeedStore[],
  selector: string,
  valuesCount: number,
  start: number = 0,
) => {
  await setDataFeeds(genericContracts, contracts, selector, valuesCount, start);

  const keys = Array.from({ length: valuesCount }, (_, i) => i + start);

  const receipts = [];
  for (const consumer of dataFeedConsumers) {
    const receipt = await consumer.setMultipleFetchedFeedsById(keys);

    receipts.push({
      contract: consumer,
      receipt: await receipt.wait(),
    });
  }

  const receiptsGeneric = [];
  for (const consumer of dataFeedGenericConsumers) {
    const receipt = await consumer.setMultipleFetchedFeedsById(keys);

    receiptsGeneric.push({
      contract: consumer,
      receipt: await receipt.wait(),
    });
  }

  for (const { contract, receipt } of receipts) {
    versionedLogger(contract, `gas used: ${Number(receipt?.gasUsed)}`);
  }

  for (const { contract, receipt } of receiptsGeneric) {
    if (isGenericV1Consumer(contract)) {
      console.log(`[Generic v1] gas used: ${Number(receipt?.gasUsed)}`);
    } else {
      console.log(`[Generic v2] gas used: ${Number(receipt?.gasUsed)}`);
    }
  }

  for (const { receipt } of receipts) {
    for (const { receipt: receiptGeneric } of receiptsGeneric) {
      expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
    }
  }
};
