import { expect } from 'chai';
import { DataFeedStore, IGenericDataFeedStore, setDataFeeds } from '.';
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

  for (const { receipt, contract } of receipts) {
    versionedLogger(contract, `gas used: ${Number(receipt?.gasUsed)}`);
  }
  for (const { contractVersion, receipt } of receiptsGeneric) {
    console.log(
      `[Generic v${contractVersion}] gas used: `,
      Number(receipt?.gasUsed),
    );
  }

  for (const data of receipts) {
    for (const dataGeneric of receiptsGeneric) {
      expect(data.receipt.gasUsed).to.be.lt(dataGeneric.receipt?.gasUsed);
    }
  }

  return { receipts, receiptsGeneric };
};
