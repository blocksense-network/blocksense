import { BaseContract } from 'ethers';
import { IConsumerWrapper } from './IConsumerWrapper';
import { IHistoricWrapper } from './IHistoricWrapper';
import { TransmissionData } from '../../helpers/common';
import { IHistoricDataFeed } from '../../../../typechain/contracts/test/consumers/historic/HistoricConsumer';

export interface IHistoricConsumerWrapper<
  T extends BaseContract,
  W extends BaseContract,
> extends IConsumerWrapper<T, W> {
  wrapper: IHistoricWrapper<W>;

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
    data: IHistoricDataFeed.TransmissionStructOutput,
  ): TransmissionData;
}
