import { BaseContract } from 'ethers';
import { IBaseWrapper } from './IBaseWrapper';

export interface IWrapper<T extends BaseContract> extends IBaseWrapper<T> {
  setterSelector: string;

  setFeeds(keys: number[], values: string[], ...args: any[]): Promise<any>;
}
