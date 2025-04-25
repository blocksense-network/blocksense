import { BaseContract } from 'ethers';
import { IWrapper } from './IWrapper';
import { TransmissionData } from '../../helpers/common';

export interface IHistoricalWrapper<T extends BaseContract>
  extends IWrapper<T> {
  checkSetTimestamps(
    keys: number[],
    blockNumbers: number[],
    ...args: any[]
  ): Promise<void>;

  checkLatestCounter(
    key: number,
    expectedCounter: number,
    ...args: any[]
  ): Promise<void>;

  checkValueAtCounter(
    key: number,
    counter: number,
    value: string,
    blockNumber: number,
    ...args: any[]
  ): Promise<void>;

  getParsedData(data: string): TransmissionData;

  getLatestCounterData(key: number): string;

  getValueAtCounterData(key: number, counter: number): string;
}
