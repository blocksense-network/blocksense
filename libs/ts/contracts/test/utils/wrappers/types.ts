import {
  CLAggregatorAdapterExp,
  CLAggregatorAdapter,
  IChainlinkAggregator,
} from '@blocksense/contracts/typechain';
import { IADFSWrapper } from './interfaces/IADFSWrapper';

export enum ReadOp {
  GetDataAtIndex = 0x06,
  GetLatestData = 0x04,
  GetLatestIndex = 0x01,
  GetLatestDataAndIndex = 0x05,
  GetLatestSingleData = 0x02,
  GetLatestSingleDataAndIndex = 0x03,
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
  index: bigint;
  stride: bigint;
  data: string;
  startSlotToReadFrom?: number;
  slotsToRead?: number;
}

export type UpgradeableProxyCallMethods = Pick<
  IADFSWrapper,
  | 'setFeeds'
  | 'checkLatestData'
  | 'checkLatestIndex'
  | 'checkDataAtIndex'
  | 'checkLatestDataAndIndex'
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
