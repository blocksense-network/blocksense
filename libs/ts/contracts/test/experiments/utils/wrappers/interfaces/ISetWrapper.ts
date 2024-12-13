import { BaseContract } from 'ethers';
import { IBaseWrapper } from './IBaseWrapper';

export interface ISetWrapper<T extends BaseContract> extends IBaseWrapper<T> {
  setFeeds(keys: number[], values: string[], ...args: any[]): Promise<any>;

  checkSetValues(
    keys: number[],
    values: string[],
    ...args: any[]
  ): Promise<void>;
}
