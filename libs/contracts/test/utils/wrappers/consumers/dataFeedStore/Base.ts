import { expect } from 'chai';
import { DataFeed } from '../../../helpers/common';
import { IConsumerWrapper } from '../../interfaces/IConsumerWrapper';
import { Consumer } from '../../../../../typechain';
import { ISetWrapper } from '../../interfaces/ISetWrapper';

export abstract class DataFeedStoreConsumerBaseWrapper
  implements IConsumerWrapper<Consumer, DataFeed>
{
  public contract!: Consumer;
  public wrapper!: ISetWrapper<DataFeed>;

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

  public async getFeedById(key: number): Promise<string> {
    return this.contract.getFeedById(key);
  }

  public async getExternalFeedById(key: number): Promise<any> {
    return this.contract.getExternalFeedById(key);
  }

  public async checkSetValues(keys: number[], values: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const value = await this.contract.getFeedById(keys[i]);
      const externalValue = await this.contract.getExternalFeedById(keys[i]);
      expect(value).to.be.eq(values[i]);
      expect(externalValue).to.be.eq(values[i]);
    }
    await this.wrapper.checkSetValues(keys, values);
  }

  public abstract init(): Promise<void>;

  public abstract getName(): string;
}
