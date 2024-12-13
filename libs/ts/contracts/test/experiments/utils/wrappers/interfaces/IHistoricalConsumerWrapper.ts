import { BaseContract } from 'ethers';
import { IConsumerWrapper } from './IConsumerWrapper';
import { IHistoricalWrapper } from './IHistoricalWrapper';
import { TransmissionData } from '../../helpers/common';
import { IHistoricalDataFeed } from '../../../../../typechain/contracts/test/experiments/consumers/historical/HistoricalConsumer';

export interface IHistoricalConsumerWrapper<
  T extends BaseContract,
  W extends BaseContract,
> extends IConsumerWrapper<T, W> {
  wrapper: IHistoricalWrapper<W>;

  checkSetTimestamps(keys: number[], blockNumbers: number[]): Promise<void>;

  checkSetValues(keys: number[], values: string[]): Promise<void>;

  checkLatestCounter(key: number, expectedCounter: number): Promise<void>;

  checkValueAtCounter(
    key: number,
    counter: number,
    value: string,
    blockNumber: number,
  ): Promise<void>;

  setMultipleFeedsAtCounter(keys: number[], counters: number[]): Promise<any>;

  setMultipleLatestFeedsById(keys: number[]): Promise<any>;

  getParsedData(
    data: IHistoricalDataFeed.TransmissionStructOutput,
  ): TransmissionData;
}
