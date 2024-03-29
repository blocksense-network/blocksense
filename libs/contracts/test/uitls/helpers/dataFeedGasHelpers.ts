import { expect } from 'chai';
import {
  DataFeedStore,
  IGenericDataFeedStore,
  checkGenericSetValues,
  checkSetValues,
  printGasUsage,
  setDataFeeds,
} from '.';
import { contractVersionLogger } from '../logger';

export const compareGasUsed = async (
  versionedLogger: ReturnType<typeof contractVersionLogger>,
  genericContracts: IGenericDataFeedStore[],
  contracts: DataFeedStore[],
  selector: string,
  valuesCount: number,
  start: number = 0,
) => {
  const { receipts, receiptsGeneric, keys, values } = await setDataFeeds(
    genericContracts,
    contracts,
    selector,
    valuesCount,
    start,
  );

  await checkSetValues(contracts, versionedLogger, keys, values);
  await checkGenericSetValues(genericContracts, keys, values);

  printGasUsage(versionedLogger, receipts, receiptsGeneric);

  for (const data of receipts) {
    for (const dataGeneric of receiptsGeneric) {
      expect(data.receipt.gasUsed).to.be.lt(dataGeneric.receipt?.gasUsed);
    }
  }

  return { receipts, receiptsGeneric };
};
