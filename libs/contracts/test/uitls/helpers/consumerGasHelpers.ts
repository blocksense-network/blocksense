import { expect } from 'chai';
import {
  DataFeedV1Consumer,
  DataFeedV2Consumer,
  DataFeedGenericConsumer,
  DataFeedGenericV2Consumer,
} from '../../../typechain';
import {
  DataFeedStore,
  IGenericDataFeedStore,
  checkGenericSetValues,
  checkSetValues,
  printGasUsage,
  setDataFeeds,
} from '.';
import { contractVersionLogger } from '../logger';

export type DataFeedConsumer = DataFeedV1Consumer | DataFeedV2Consumer;
export type GenericDataFeedConsumer =
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
  dataFeedGenericConsumers: GenericDataFeedConsumer[],
  dataFeedConsumers: DataFeedConsumer[],
  genericContracts: IGenericDataFeedStore[],
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

  await checkSetValues(contracts, versionedLogger, keys, values);
  await checkGenericSetValues(genericContracts, keys, values);

  printGasUsage(
    versionedLogger,
    receipts,
    receiptsGeneric.map(({ receipt, contract }) => ({
      receipt,
      contractVersion: isGenericV1Consumer(contract) ? 1 : 2,
    })),
  );

  for (const { receipt } of receipts) {
    for (const { receipt: receiptGeneric } of receiptsGeneric) {
      expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
    }
  }
};
