import { expect } from 'chai';
import { printGasUsage, setDataFeeds, Consumer } from './common';
import { IConsumerWrapper } from '../../utils/wrappers';
import { BaseContract } from 'ethers';

export const compareConsumerGasUsed = async <
  G extends BaseContract,
  B extends BaseContract,
>(
  genericContractWrappers: IConsumerWrapper<Consumer, G>[],
  contractWrappers: IConsumerWrapper<Consumer, B>[],
  valuesCount: number,
  start: number = 0,
) => {
  const { keys, values } = await setDataFeeds(
    genericContractWrappers.map(c => c.wrapper),
    contractWrappers.map(c => c.wrapper),
    valuesCount,
    start,
  );

  const receipts = [];
  for (const consumer of contractWrappers) {
    const receipt = await consumer.setMultipleFetchedFeedsById(keys);

    receipts.push(await receipt.wait());
  }

  const receiptsGeneric = [];
  for (const consumer of genericContractWrappers) {
    const receipt = await consumer.setMultipleFetchedFeedsById(keys);

    receiptsGeneric.push(await receipt.wait());
  }

  for (let i = 0; i < keys.length; i++) {
    for (const consumer of [...contractWrappers, ...genericContractWrappers]) {
      await consumer.checkSetValues([keys[i]], [values[i]]);
    }
  }

  await printGasUsage(
    genericContractWrappers,
    contractWrappers,
    receipts,
    receiptsGeneric,
  );

  for (const receipt of receipts) {
    for (const receiptGeneric of receiptsGeneric) {
      expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
    }
  }
};
