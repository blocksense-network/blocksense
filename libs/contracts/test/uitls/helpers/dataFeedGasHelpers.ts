import { expect } from 'chai';
import {
  DataFeedStore,
  IGenericDataFeedStore,
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
  const { receipts, receiptsGeneric } = await setDataFeeds(
    genericContracts,
    contracts,
    selector,
    valuesCount,
    start,
  );

  printGasUsage(versionedLogger, receipts, receiptsGeneric);

  for (const data of receipts) {
    for (const dataGeneric of receiptsGeneric) {
      expect(data.receipt.gasUsed).to.be.lt(dataGeneric.receipt?.gasUsed);
    }
  }

  return { receipts, receiptsGeneric };
};
