import {
  CLAggregatorAdapterExp,
  CLAggregatorAdapter,
  IChainlinkAggregator,
} from '../../../typechain';
import { IADFSWrapper } from './interfaces/IADFSWrapper';

export enum ReadOp {
  GetFeedAtRound = 0x06,
  GetLatestFeed = 0x04,
  GetLatestRound = 0x01,
  GetLatestFeedAndRound = 0x05,
  GetLatestSingleFeed = 0x02,
  GetLatestSingleFeedAndRound = 0x03,
}

export enum WriteOp {
  SetFeeds = 0x01,
}

export enum ProxyOp {
  UpgradeTo = '0x00000001',
  SetAdmin = '0x00000002',
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

export type RegistryUnderlier =
  | CLAggregatorAdapterExp
  | CLAggregatorAdapter
  | IChainlinkAggregator;
