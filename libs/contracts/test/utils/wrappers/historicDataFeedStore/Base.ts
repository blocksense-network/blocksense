import { ethers } from 'hardhat';
import { DataFeedStoreBaseWrapper } from '../dataFeedStore/Base';
import { expect } from 'chai';
import { DataFeedStore } from '../../helpers/common';
import { IHistoricWrapper } from '../interfaces/IHistoricWrapper';

export abstract class HistoricDataFeedStoreBaseWrapper
  extends DataFeedStoreBaseWrapper<DataFeedStore>
  implements IHistoricWrapper<DataFeedStore>
{
  public async checkSetValues(
    keys: number[],
    values: string[],
    ...args: any[]
  ): Promise<void> {
    for (const [index, key] of keys.entries()) {
      const storedValue = await this.getValue(
        this.getLatestValueData(key),
        ...args,
      );

      const data = storedValue.slice(0, 48).padEnd(66, '0');
      expect(data).to.equal(values[index]);
    }
  }

  public async checkSetTimestamps(
    keys: number[],
    blockNumbers: number[],
    ...args: any[]
  ): Promise<void> {
    for (const [index, key] of keys.entries()) {
      const storedValue = await this.getValue(
        this.getLatestValueData(key),
        ...args,
      );

      const timestamp = ethers.toNumber(
        '0x' + storedValue.slice(48, storedValue.length),
      );

      expect(timestamp).to.equal(
        (await ethers.provider.getBlock(blockNumbers[index]))?.timestamp,
      );
    }
  }

  public async checkLatestCounter(
    key: number,
    expectedCounter: number,
    ...args: any[]
  ): Promise<void> {
    const counter = await this.getValue(
      this.getLatestCounterData(key),
      ...args,
    );

    expect(+counter).to.equal(expectedCounter);
  }

  public async checkValueAtCounter(
    key: number,
    counter: number,
    value: string,
    blockNumber: number,
    ...args: any[]
  ): Promise<void> {
    const storedValue = await this.getValue(
      this.getValueAtCounterData(key, counter),
      ...args,
    );

    const data = storedValue.slice(0, 48).padEnd(66, '0');
    const timestamp = ethers.toNumber(
      '0x' + storedValue.slice(48, storedValue.length),
    );

    expect(data).to.equal(value);
    expect(timestamp).to.equal(
      (await ethers.provider.getBlock(blockNumber))?.timestamp,
    );
  }

  public abstract getLatestCounterData(key: number): string;

  public abstract getValueAtCounterData(key: number, counter: number): string;
}
