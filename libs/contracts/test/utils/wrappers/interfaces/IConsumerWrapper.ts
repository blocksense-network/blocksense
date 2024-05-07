import { BaseContract } from 'ethers';
import { ISetWrapper } from './ISetWrapper';
import { IBaseWrapper } from './IBaseWrapper';

export interface IConsumerWrapper<
  T extends BaseContract,
  W extends BaseContract,
> extends IBaseWrapper<T> {
  wrapper: ISetWrapper<W>;

  getFeedById(key: number): Promise<any>;

  getExternalFeedById(key: number): Promise<any>;

  setMultipleFetchedFeedsById(keys: number[]): Promise<any>;
}
