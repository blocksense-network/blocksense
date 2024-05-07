import { BaseContract } from 'ethers';
import { IWrapper } from './IWrapper';

export interface IHistoricWrapper<T extends BaseContract> extends IWrapper<T> {
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

  getLatestCounterData(key: number): string;

  getValueAtCounterData(key: number, counter: number): string;
}
