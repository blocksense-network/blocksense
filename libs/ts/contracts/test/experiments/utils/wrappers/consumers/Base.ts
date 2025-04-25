import { expect } from 'chai';
import { IConsumerWrapper } from '../interfaces/IConsumerWrapper';
import { ISetWrapper } from '../interfaces/ISetWrapper';
import { BaseContract } from 'ethers';
import { Consumer, TransmissionData } from '../../helpers/common';

export abstract class DataFeedStoreConsumerBaseWrapper<U extends BaseContract>
  implements IConsumerWrapper<Consumer, U>
{
  public contract!: Consumer;
  public wrapper!: ISetWrapper<U>;

  public async setFeeds(
    keys: number[],
    values: string[],
    ...args: any[]
  ): Promise<any> {
    return this.wrapper.setFeeds(keys, values, ...args);
  }

  public async setMultipleFetchedFeedsById(keys: number[]) {
    return this.contract.setMultipleFetchedFeedsById(keys);
  }

  public async getFeedById(key: number): Promise<string | TransmissionData> {
    return this.contract.getFeedById(key);
  }

  public async checkSetValues(keys: number[], values: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const value = await this.contract.getFeedById(keys[i]);
      expect(value).to.be.eq(values[i]);
    }
    await this.wrapper.checkSetValues(keys, values);
  }

  public abstract init(): Promise<void>;

  public abstract getName(): string;
}
