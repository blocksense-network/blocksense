import { Feed, ReadFeed, ReadOp } from '../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { AggregatedDataFeedStore } from '@blocksense/contracts/typechain';
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
      sourceAccumulator?: string;
      destinationAccumulator?: string;
      txData?: any;
    },
  ): Promise<{
    tx: TransactionResponse;
    sourceAccumulator: string;
    destinationAccumulator: string;
  }>;

  checkEvent(receipt: TransactionReceipt, destinationAccumulator: string): void;

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
