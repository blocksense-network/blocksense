import { IBaseWrapper } from '../../../experiments/utils/wrappers';
import {
  AggregatedDataFeedStore,
  UpgradeableProxyADFS,
} from '../../../../typechain';
import { Feed, UpgradeableProxyCallMethods } from '../types';
import { TransactionResponse } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ADFSGenericWrapper } from '../adfs/ADFSGeneric';
import { ADFSWrapper } from '../adfs/ADFS';
import { ADFSReadACWrapper } from '../adfs/ADFSReadAC';

export interface IUpgradeableProxyADFSWrapper
  extends IBaseWrapper<AggregatedDataFeedStore> {
  contract: UpgradeableProxyADFS;
  implementation: ADFSWrapper | ADFSReadACWrapper | ADFSGenericWrapper;

  upgradeImplementation(
    newImplementation: ADFSWrapper | ADFSReadACWrapper,
    admin: HardhatEthersSigner,
    opts?: {
      txData?: any;
    },
  ): Promise<TransactionResponse>;

  setAdmin(
    admin: HardhatEthersSigner,
    newAdmin: string,
  ): Promise<TransactionResponse>;

  proxyCall<T extends keyof UpgradeableProxyCallMethods>(
    method: T,
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    ...args: any[]
  ): Promise<ReturnType<UpgradeableProxyCallMethods[T]>>;
}
