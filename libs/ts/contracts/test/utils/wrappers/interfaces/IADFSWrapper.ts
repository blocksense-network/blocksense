import { Feed, ReadOp } from '../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { AggregatedDataFeedStore } from '../../../../typechain';
import { AccessControlWrapper } from '../adfs/AccessControl';
import { IBaseWrapper } from '../../../experiments/utils/wrappers';
import { TransactionResponse } from 'ethers';

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

  checkLatestValue(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
    },
  ): Promise<void>;

  checkLatestRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
    },
  ): Promise<void>;

  checkValueAtRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
    },
  ): Promise<void>;

  checkLatestFeedAndRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
    },
  ): Promise<void>;

  getValues(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts?: {
      txData?: any;
      operations?: ReadOp[];
    },
  ): Promise<string[]>;
}
