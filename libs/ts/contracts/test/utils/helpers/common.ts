import { ethers } from 'ethers';
import { IADFSWrapper } from '../wrappers';
import { Feed } from '../wrappers/types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { IUpgradeableProxyADFSWrapper } from '../wrappers/interfaces/IUpgradeableProxyADFSWarpper';

export const setFeeds = async (
  sequencer: HardhatEthersSigner,
  genericContractWrappers: IADFSWrapper[] | IUpgradeableProxyADFSWrapper[],
  contractWrappers: IADFSWrapper[] | IUpgradeableProxyADFSWrapper[],
  valuesCount: number,
  adfsData?: {
    skip?: number; // used to skip feeds so to make testing round table write
    round?: bigint;
    stride?: bigint;
  },
  start: number = 0,
) => {
  const feeds: Feed[] = [];

  for (let i = start; i < valuesCount; i++) {
    feeds.push({
      id: BigInt(i * (adfsData?.skip ?? 1)),
      round: adfsData?.round ?? 1n,
      stride: adfsData?.stride ?? 0n,
      data: ethers.hexlify(ethers.randomBytes(24)),
    });
  }

  const receipts = [];
  for (const contract of contractWrappers) {
    if (isUpgradeableProxy(contract)) {
      receipts.push(
        await (await contract.proxyCall('setFeeds', sequencer, feeds)).wait(),
      );
    } else {
      receipts.push(await (await contract.setFeeds(sequencer, feeds)).wait());
    }
  }

  const receiptsGeneric = [];
  for (const contract of genericContractWrappers) {
    if (isUpgradeableProxy(contract)) {
      receiptsGeneric.push(
        await (await contract.proxyCall('setFeeds', sequencer, feeds)).wait(),
      );
    } else {
      receiptsGeneric.push(
        await (await contract.setFeeds(sequencer, feeds)).wait(),
      );
    }
  }

  return { receipts, receiptsGeneric, feeds };
};

export const isUpgradeableProxy = (
  contract: IADFSWrapper | IUpgradeableProxyADFSWrapper,
): contract is IUpgradeableProxyADFSWrapper => {
  return (
    (contract as IUpgradeableProxyADFSWrapper).implementation !== undefined
  );
};

export const generateRandomFeeds = (count: number): Feed[] => {
  const feeds: Feed[] = [];

  for (let i = 0; i < count; i++) {
    const stride = BigInt(Math.floor(Math.random() * 32));
    const data = ethers.hexlify(ethers.randomBytes(Number(stride + 1n) * 32));
    const maxSlots = Math.floor(
      Math.random() * Math.ceil((data.length - 2) / 64) + 1,
    );
    const startSlotToReadFrom = Math.floor(Math.random() * maxSlots);

    feeds.push({
      // random number between 0 and 2**115
      id: BigInt(Math.floor(Math.random() * (2 ** 115 + 1))),
      // random number between 0 and 2**13
      round: BigInt(Math.floor(Math.random() * 2 ** 13 + 1)),
      // random number between 0 and 31
      stride,
      // random bytes depending on the stride (here we won't use max numbers to avoid overflow)
      data,
      // random number between 0 and maxSlots - 1
      startSlotToReadFrom,
      // random number between 1 and maxSlots - startSlotToReadFrom
      slotsToRead:
        Math.floor(Math.random() * (maxSlots - startSlotToReadFrom)) + 1,
    });
  }

  return feeds;
};

export const encodeDataAndTimestamp = (
  data: number | bigint,
  timestampValue?: number | bigint,
): string => {
  const value = '0x' + data.toString(16).padStart(48, '0');
  const timestamp =
    '0x' +
    BigInt(timestampValue ?? Math.floor(Date.now() / 1000))
      .toString(16)
      .padStart(16, '0');
  return ethers.concat([value, timestamp]);
};

export const encodeData = (value: number | bigint) => {
  return '0x' + value.toString(16).padStart(48, '0').padEnd(64, '0');
};
