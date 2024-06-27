import { ethers } from 'hardhat';
import { SportsDataFeedStoreV1, SportsDataFeedStoreV2 } from '../typechain';
import {
  IWrapper,
  SportsDataFeedStoreBaseWrapper,
  SportsDataFeedStoreV1Wrapper,
  SportsDataFeedStoreV2Wrapper,
} from './utils/wrappers';
import { initWrappers, printGasUsage } from './utils/helpers/common';
import { BaseContract } from 'ethers';

let contractWrappers: SportsDataFeedStoreBaseWrapper<
  SportsDataFeedStoreV1 | SportsDataFeedStoreV2
>[] = [];

describe.only('SportsDataFeedStore', () => {
  beforeEach(async () => {
    await initWrappers(contractWrappers, [
      SportsDataFeedStoreV1Wrapper,
      SportsDataFeedStoreV2Wrapper,
    ]);
  });

  it('Should set data correctly', async () => {
    const { receipts, keys, values, descriptions } = await prepareData(
      [],
      contractWrappers,
      [2, 3],
      123,
    );

    for (const [i, contractWrapper] of contractWrappers.entries()) {
      await contractWrapper.checkSetValues(keys, values);
      contractWrapper.checkEvents(receipts[i], keys, descriptions);
    }

    await printGasUsage([], contractWrappers, receipts, []);
  });
});

const prepareData = async <G extends BaseContract, B extends BaseContract>(
  genericContractWrappers: IWrapper<G>[],
  contractWrappers: IWrapper<B>[],
  valuesPerKeysCount: number[],
  start: number = 0,
) => {
  const keys = Array.from(
    { length: valuesPerKeysCount.length },
    (_, i) => i + (i > 0 ? valuesPerKeysCount[i - 1] : 0) + start,
  );
  const values: string[] = [];
  const descriptions: string[] = keys.map(key =>
    ethers.encodeBytes32String(`Hello, World! ${key}`),
  );

  for (const valuesPerKey of valuesPerKeysCount) {
    const parsedValues: string[] = [];
    for (let i = 0; i < valuesPerKey; i++) {
      parsedValues.push(encodeData([i + start]));
    }
    values.push(parsedValues.join(';'));
  }

  const receipts = [];
  for (const contract of contractWrappers) {
    receipts.push(await contract.setFeeds(keys, values, descriptions));
  }

  const receiptsGeneric = [];
  for (const contract of genericContractWrappers) {
    receiptsGeneric.push(await contract.setFeeds(keys, values, descriptions));
  }

  return { receipts, receiptsGeneric, keys, values, descriptions };
};

const encodeData = (data: number[]) => {
  return ethers
    .solidityPacked(
      data.map(() => 'uint32'),
      data,
    )
    .padEnd(66, '0');
};
