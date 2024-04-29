import { expect } from 'chai';
import { GenericDataFeedStore } from '../../helpers/common';
import { IWrapper } from '../interfaces/IWrapper';

export abstract class DataFeedStoreGenericBaseWrapper
  implements IWrapper<GenericDataFeedStore>
{
  public contract!: GenericDataFeedStore;
  public readonly setterSelector: string;

  constructor(selector: string) {
    this.setterSelector = selector;
  }

  public async checkSetValues(keys: number[], values: string[]) {
    for (let i = 0; i < keys.length; i++) {
      const value = await this.getValue(keys[i]);
      expect(value).to.be.eq(values[i]);
    }
  }

  public async getValue(key: number): Promise<string> {
    return this.contract.getDataFeed(key);
  }

  public abstract init(): Promise<void>;

  public abstract setFeeds(keys: number[], values: string[]): Promise<any>;

  public abstract getName(): string;
}
