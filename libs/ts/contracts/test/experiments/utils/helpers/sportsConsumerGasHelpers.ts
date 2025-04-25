import { expect } from 'chai';
import { SportsConsumer, encodeData, printGasUsage } from './common';
import { ISportsConsumerWrapper } from '../../utils/wrappers';
import { BaseContract } from 'ethers';
import { ethers } from 'hardhat';

const SLOT = 8;
const UINT32_PER_TYPE = {
  football: 10,
  basketball: 18,
};

export const compareSportsConsumerGasUsed = async <
  G extends BaseContract,
  B extends BaseContract,
>(
  genericContractWrappers: ISportsConsumerWrapper<SportsConsumer, G>[],
  contractWrappers: ISportsConsumerWrapper<SportsConsumer, B>[],
  types: ('basketball' | 'football')[],
) => {
  let keys: number[] = [];
  let values: string[] = [];
  let descriptions: string[] = [];

  let nextKey = 0;
  for (const [i, type] of types.entries()) {
    keys.push(nextKey);
    nextKey += Math.ceil(UINT32_PER_TYPE[type] / SLOT);

    let parsedValues: string[] = [];
    let slot = UINT32_PER_TYPE[type];
    while (slot > 0) {
      parsedValues.push(
        encodeData(
          [...Array(Math.min(SLOT, slot))].map(() =>
            Math.floor(Math.random() * 10),
          ),
        ),
      );

      slot -= SLOT;
    }

    values.push(parsedValues.join(';'));
    descriptions.push(ethers.encodeBytes32String(`Hello, World! ${i}`));
  }

  for (const wrapper of [...contractWrappers, ...genericContractWrappers]) {
    await wrapper.setFeeds(keys, values, descriptions);
  }

  for (const wrapper of [...contractWrappers, ...genericContractWrappers]) {
    await wrapper.checkSetValues(keys, values, types);
  }

  let receipts: any[][] = [];
  let receiptsGeneric: any[][] = [];
  for (let i = 0; i < types.length; i++) {
    let intermediateReceipts: any[] = [];
    for (const contractWrapper of contractWrappers) {
      const { receipt } = await contractWrapper.decodeData(types[i], keys[i]);
      intermediateReceipts.push(receipt);
    }
    receipts.push(intermediateReceipts);

    intermediateReceipts = [];
    for (const contractWrapper of genericContractWrappers) {
      const { receipt } = await contractWrapper.decodeData(types[i], keys[i]);
      intermediateReceipts.push(receipt);
    }
    receiptsGeneric.push(intermediateReceipts);
  }

  for (let i = 0; i < receipts.length; i++) {
    await printGasUsage(
      genericContractWrappers,
      contractWrappers,
      receipts[i],
      receiptsGeneric[i],
    );
  }

  for (let i = 0; i < receipts.length; i++) {
    for (const data of receipts[i]) {
      for (const dataGeneric of receiptsGeneric[i]) {
        expect(Number(data?.gasUsed)).to.be.lessThan(
          Number(dataGeneric?.gasUsed),
        );
      }
    }
  }

  return { receipts, receiptsGeneric, keys, values };
};
