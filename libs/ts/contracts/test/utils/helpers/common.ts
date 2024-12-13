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
