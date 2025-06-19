import { IBaseWrapper } from '../../../experiments/utils/wrappers';
import {
  AggregatedDataFeedStore,
  UpgradeableProxyADFS,
} from '@blocksense/contracts/typechain';
import { ADFSWrapper } from '../adfs/ADFS';
import { Feed, UpgradeableProxyCallMethods } from '../types';
import { TransactionResponse } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ADFSGenericWrapper } from '../adfs/ADFSGeneric';

export interface IUpgradeableProxyADFSWrapper
  extends IBaseWrapper<AggregatedDataFeedStore> {
  contract: UpgradeableProxyADFS;
  implementation: ADFSWrapper | ADFSGenericWrapper;

  upgradeImplementationAndCall(
    newImplementation: ADFSWrapper,
    admin: HardhatEthersSigner,
    calldata: string,
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
