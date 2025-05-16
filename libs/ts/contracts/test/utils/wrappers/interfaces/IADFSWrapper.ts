import { Feed, ReadFeed, ReadOp } from '../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { AggregatedDataFeedStore } from '../../../../typechain';
import { AccessControlWrapper } from '../adfs/AccessControl';
import { IBaseWrapper } from '../../../experiments/utils/wrappers';
import { EventFragment, TransactionReceipt, TransactionResponse } from 'ethers';

export interface IADFSWrapper extends IBaseWrapper<AggregatedDataFeedStore> {
  contract: AggregatedDataFeedStore;
  accessControl: AccessControlWrapper;

  setFeeds(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      blockNumber?: number;
      txData?: any;
    },
  ): Promise<TransactionResponse>;

  checkEvent(receipt: TransactionReceipt, newBlockNumber: number): void;

  getEventFragment(): EventFragment;

  checkLatestData(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
    },
  ): Promise<void>;

  checkLatestIndex(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
    },
  ): Promise<void>;

  checkDataAtIndex(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
    },
  ): Promise<void>;

  checkLatestDataAndIndex(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
    },
  ): Promise<void>;

  getValues(
    caller: HardhatEthersSigner,
    feeds: ReadFeed[],
    opts?: {
      txData?: any;
      operations?: ReadOp[];
    },
  ): Promise<string[]>;
}
