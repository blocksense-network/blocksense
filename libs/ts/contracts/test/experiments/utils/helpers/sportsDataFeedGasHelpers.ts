import { expect } from 'chai';
import { printGasUsage, setSportsDataFeeds } from './common';
import { ISportsWrapper } from '../../utils/wrappers';
import { BaseContract } from 'ethers';

export const compareGasUsed = async <
  G extends BaseContract,
  B extends BaseContract,
>(
  genericContractWrappers: ISportsWrapper<G>[],
  contractWrappers: ISportsWrapper<B>[],
  slotsCount: number[],
  start: number = 0,
) => {
  const { receipts, receiptsGeneric, keys, values, descriptions } =
    await setSportsDataFeeds(
      genericContractWrappers,
      contractWrappers,
      slotsCount,
      start,
    );

  for (const wrapper of [...contractWrappers, ...genericContractWrappers]) {
    await wrapper.checkSetValues(keys, values);
  }

  for (const [i, contractWrapper] of contractWrappers.entries()) {
    contractWrapper.checkEvents(receipts[i], keys, descriptions);
  }
  for (const [i, contractWrapper] of genericContractWrappers.entries()) {
    contractWrapper.checkEvents(receiptsGeneric[i], keys, descriptions);
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
