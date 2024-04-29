import { BaseContract } from 'ethers';
import { IWrapper } from './IWrapper';
import { IBaseWrapper } from './IBaseWrapper';

export interface IConsumerWrapper<
  T extends BaseContract,
  W extends BaseContract,
> extends IBaseWrapper<T> {
  wrapper: IWrapper<W>;

  getFeedById(key: number): Promise<any>;

  getExternalFeedById(key: number): Promise<any>;

  setMultipleFetchedFeedsById(keys: number[]): Promise<any>;
}
