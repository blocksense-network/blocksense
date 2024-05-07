import { BaseContract } from 'ethers';
import { ISetWrapper } from './ISetWrapper';

export interface IWrapper<T extends BaseContract> extends ISetWrapper<T> {
  getLatestValueData(key: number): string;

  getValue(data: string, ...args: any[]): Promise<string>;
}
