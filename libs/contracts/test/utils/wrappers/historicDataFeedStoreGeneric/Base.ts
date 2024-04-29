import { ethers } from 'hardhat';
import { expect } from 'chai';
import { IWrapper } from '../interfaces/IWrapper';
import { GenericHistoricDataFeedStore } from '../../helpers/common';
import { IHistoricDataFeed } from '../../../../typechain/contracts/test/HistoricDataFeedStoreGenericV1';

export abstract class HistoricDataFeedStoreGenericBaseWrapper
  implements IWrapper<GenericHistoricDataFeedStore>
{
  public contract!: GenericHistoricDataFeedStore;
  public readonly setterSelector: string;

  constructor(selector: string) {
    this.setterSelector = selector;
  }

  public async getValue(
    key: number,
  ): Promise<IHistoricDataFeed.TransmissionStructOutput> {
    return this.contract.getDataFeed(key);
  }

  public async checkSetValues(keys: number[], values: string[]) {
    for (let i = 0; i < keys.length; i++) {
      const data = await this.getValue(keys[i]);
      expect(data[0].padEnd(66, '0')).to.be.eq(values[i]);
    }
  }

  public async checkSetTimestamps(
    keys: number[],
    blockNumbers: number[],
  ): Promise<void> {
    for (const [index, key] of keys.entries()) {
      const data = await this.getValue(key);

      expect(data[1]).to.equal(
        (await ethers.provider.getBlock(blockNumbers[index]))?.timestamp,
      );
    }
  }

  public async checkLatestCounter(
    key: number,
    expectedCounter: number,
  ): Promise<void> {
    const counter = await this.contract.getLatestCounter(key);

    expect(Number(counter)).to.equal(expectedCounter);
  }

  public async checkValueAtCounter(
    key: number,
    counter: number,
    value: string,
    blockNumber: number,
  ): Promise<void> {
    const data = await this.contract.getFeedAtCounter(key, counter);

    expect(data[0].padEnd(66, '0')).to.equal(value);
    expect(data[1]).to.equal(
      (await ethers.provider.getBlock(blockNumber))?.timestamp,
    );
  }

  public abstract init(): Promise<void>;

  public abstract setFeeds(keys: number[], values: string[]): Promise<any>;

  public abstract getName(): string;
}
