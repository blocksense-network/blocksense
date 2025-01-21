import {
  CLAggregatorAdapterExp,
  CLAggregatorAdapter,
  IChainlinkAggregator,
} from '../../../typechain';
import { IADFSWrapper } from './interfaces/IADFSWrapper';

export enum ReadOp {
  GetFeedAtRound = 0x04,
  GetLatestFeed = 0x02,
  GetLatestRound = 0x01,
  GetLatestFeedAndRound = 0x03,
}

export type ReadFeed = Omit<Feed, 'data' | 'slotsToRead'> &
  (
    | { data: string; slotsToRead: number } // Both are present
    | { data: string; slotsToRead?: never } // Only data is present
    | { slotsToRead: number; data?: never } // Only slotsToRead is present
  );

export interface Feed {
  id: bigint;
  round: bigint;
  stride: bigint;
  data: string;
  startSlotToReadFrom?: number;
  slotsToRead?: number;
}

export type UpgradeableProxyCallMethods = Pick<
  IADFSWrapper,
  | 'setFeeds'
  | 'checkLatestValue'
  | 'checkLatestRound'
  | 'checkValueAtRound'
  | 'checkLatestFeedAndRound'
  | 'getValues'
>;

export type OracleUnderlier =
  | CLAggregatorAdapterExp
  | CLAggregatorAdapter
  | IChainlinkAggregator;
