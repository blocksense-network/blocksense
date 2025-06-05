import { ethers } from 'hardhat';
import { DataFeedStoreBaseWrapper } from '../basic/Base';
import { expect } from 'chai';
import {
  GenericHistoricalDataFeedStore,
  HistoricalDataFeedStore,
  TransmissionData,
} from '../../helpers/common';
import { IHistoricalWrapper } from '../../../utils/wrappers/interfaces/IHistoricalWrapper';

export abstract class HistoricalDataFeedStoreBaseWrapper
  extends DataFeedStoreBaseWrapper<
    HistoricalDataFeedStore | GenericHistoricalDataFeedStore
  >
  implements
    IHistoricalWrapper<HistoricalDataFeedStore | GenericHistoricalDataFeedStore>
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

      const data = this.getParsedData(storedValue);
      expect(data.value).to.equal(values[index]);
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

      const data = this.getParsedData(storedValue);

      expect(data.timestamp).to.equal(
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

    const data = this.getParsedData(storedValue);

    expect(data.value).to.equal(value);
    expect(data.timestamp).to.equal(
      (await ethers.provider.getBlock(blockNumber))?.timestamp,
    );
  }

  public getParsedData(data: string): TransmissionData {
    const value = data.slice(0, 50).padEnd(66, '0');
    const timestamp = ethers.toBigInt('0x' + data.slice(50, 66));

    return { value, timestamp };
  }

  public abstract getLatestCounterData(key: number): string;

  public abstract getValueAtCounterData(key: number, counter: number): string;
}
