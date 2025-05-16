import { BaseContract } from 'ethers';
import {
  printGasUsage,
  setDataFeeds,
} from '../../experiments/utils/helpers/common';
import { IBaseWrapper, IWrapper } from '../../experiments/utils/wrappers';
import { isUpgradeableProxy, setFeeds } from './common';
import { IADFSWrapper } from '../wrappers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { IUpgradeableProxyADFSWrapper } from '../wrappers/interfaces/IUpgradeableProxyADFSWarpper';
import { ethers } from 'hardhat';

export const compareGasUsed = async <
  G extends BaseContract,
  B extends BaseContract,
>(
  sequencer: HardhatEthersSigner,
  genericContractWrappers: IWrapper<G>[],
  contractWrappers: IWrapper<B>[],
  adfsContractWrappers: IADFSWrapper[] | IUpgradeableProxyADFSWrapper[],
  adfsGenericContractWrappers: IADFSWrapper[] | IUpgradeableProxyADFSWrapper[],
  valuesCount: number,
  adfsData?: {
    skip?: number; // used to skip feeds so to make testing ring buffer index table write
    index?: bigint;
    stride?: bigint;
  },
  start: number = 0,
) => {
  const experimentsData = await setDataFeeds(
    genericContractWrappers,
    contractWrappers,
    valuesCount,
    start,
  );
  const data = await setFeeds(
    sequencer,
    adfsGenericContractWrappers,
    adfsContractWrappers,
    valuesCount,
    adfsData,
    start,
  );

  for (const wrapper of [...contractWrappers, ...genericContractWrappers]) {
    await wrapper.checkSetValues(experimentsData.keys, experimentsData.values);
  }

  for (const wrapper of [
    ...adfsContractWrappers,
    ...adfsGenericContractWrappers,
  ]) {
    if (isUpgradeableProxy(wrapper)) {
      await wrapper.proxyCall('checkLatestData', sequencer, data.feeds);
    } else {
      await wrapper.checkLatestData(sequencer, data.feeds);
    }
  }

  for (const receipt of data.receipts) {
    for (const wrapper of adfsContractWrappers) {
      const tx = await ethers.provider.getTransaction(receipt?.hash!);
      const blockNumberInReceipt = parseInt('0x' + tx!.data.slice(4, 20), 16);
      if (!isUpgradeableProxy(wrapper)) {
        wrapper.checkEvent(receipt!, blockNumberInReceipt);
      }
    }
  }

  await printGasUsage(
    [
      ...genericContractWrappers,
      ...adfsGenericContractWrappers,
    ] as IBaseWrapper<G>[],
    [...contractWrappers, ...adfsContractWrappers] as IBaseWrapper<B>[],
    experimentsData.receipts.concat(data.receipts),
    data.receiptsGeneric.concat(experimentsData.receiptsGeneric),
  );
};
