import { expect } from 'chai';
import { printGasUsage, setDataFeeds } from './common';
import { IWrapper } from '../wrappers/IWrapper';
import { ethers } from 'ethers';

export const compareGasUsed = async <
  G extends ethers.BaseContract,
  B extends ethers.BaseContract,
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

  const map: Record<string, IWrapper<G | B>> = {};
  for (const wrapper of [...contractWrappers, ...genericContractWrappers]) {
    map[wrapper.contract.target.toString()] = wrapper;
  }

  await printGasUsage(map, receipts, receiptsGeneric);

  for (const data of receipts) {
    for (const dataGeneric of receiptsGeneric) {
      expect(Number(data?.gasUsed)).to.be.lessThan(
        Number(dataGeneric?.gasUsed),
      );
    }
  }

  return { receipts, receiptsGeneric, keys, values };
};
