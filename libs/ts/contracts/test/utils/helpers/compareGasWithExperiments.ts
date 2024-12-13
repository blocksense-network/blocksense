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
    skip?: number; // used to skip feeds so to make testing round table write
    round?: bigint;
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
      await wrapper.proxyCall('checkLatestValue', sequencer, data.feeds);
    } else {
      await wrapper.checkLatestValue(sequencer, data.feeds);
    }
  }

  await printGasUsage(
    [
      ...genericContractWrappers,
      ...adfsGenericContractWrappers,
    ] as IBaseWrapper<G>[],
    [...contractWrappers, ...adfsContractWrappers] as IBaseWrapper<B>[],
    experimentsData.receipts.concat(data.receipts),
    experimentsData.receiptsGeneric.concat(data.receiptsGeneric),
  );
};
