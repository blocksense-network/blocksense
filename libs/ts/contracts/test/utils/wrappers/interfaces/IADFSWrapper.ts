import { Feed, ReadOp } from '../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { AggregatedDataFeedStore } from '../../../../typechain';
import { AccessControlWrapper } from '../adfs/AccessControl';

export interface IADFSWrapper {
  contract: AggregatedDataFeedStore;
  accessControl: AccessControlWrapper;

  init(...args: any[]): Promise<void>;

  getName(): string;

  setFeeds(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    options: {
      blockNumber?: number;
      txData?: any;
    },
  ): Promise<any>;

  checkLatestValue(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    options: {
      txData?: any;
    },
  ): Promise<void>;

  checkLatestRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    options: {
      txData?: any;
    },
  ): Promise<void>;

  checkValueAtRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    options: {
      txData?: any;
    },
  ): Promise<void>;

  checkLatestFeedAndRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    options: {
      txData?: any;
    },
  ): Promise<void>;

  getValues(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    options: {
      txData?: any;
      operations?: ReadOp[];
    },
  ): Promise<string[]>;
}
