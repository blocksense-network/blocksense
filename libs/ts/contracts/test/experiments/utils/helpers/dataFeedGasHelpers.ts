import { expect } from 'chai';
import { printGasUsage, setDataFeeds } from './common';
import { IWrapper } from '../../utils/wrappers';
import { BaseContract } from 'ethers';

export const compareGasUsed = async <
  G extends BaseContract,
  B extends BaseContract,
>(
  genericContractWrappers: IWrapper<G>[],
  contractWrappers: IWrapper<B>[],
  valuesCount: number,
  start: number = 0,
) => {
  const { receipts, receiptsGeneric, keys, values } = await setDataFeeds(
    genericContractWrappers,
    contractWrappers,
    valuesCount,
    start,
  );

  for (const wrapper of [...contractWrappers, ...genericContractWrappers]) {
    await wrapper.checkSetValues(keys, values);
  }

  await printGasUsage(
    genericContractWrappers,
    contractWrappers,
    receipts,
    receiptsGeneric,
  );

  for (const data of receipts) {
    for (const dataGeneric of receiptsGeneric) {
      expect(Number(data?.gasUsed)).to.be.lessThan(
        Number(dataGeneric?.gasUsed),
      );
    }
  }

  return { receipts, receiptsGeneric, keys, values };
};
