import { BaseContract } from 'ethers';
import { ISetWrapper } from './ISetWrapper';
import { IBaseWrapper } from './IBaseWrapper';
import { TransmissionData } from '../../helpers/common';

export interface IConsumerWrapper<
  T extends BaseContract,
  W extends BaseContract,
> extends IBaseWrapper<T> {
  wrapper: ISetWrapper<W>;

  getFeedById(key: number): Promise<string | TransmissionData>;

  setMultipleFetchedFeedsById(keys: number[]): Promise<any>;

  checkSetValues(
    keys: number[],
    values: string[],
    ...args: any[]
  ): Promise<void>;
}
