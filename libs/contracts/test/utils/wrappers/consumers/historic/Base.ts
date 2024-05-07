import { expect } from 'chai';
import { HistoricConsumer } from '../../../../../typechain';
import { BaseContract } from 'ethers';
import { DataFeedStoreConsumerBaseWrapper } from '../Base';
import { IHistoricWrapper } from '../../interfaces/IHistoricWrapper';
import { ethers } from 'hardhat';
import { IHistoricConsumerWrapper } from '../../interfaces/IHistoricConsumerWrapper';
import { TransmissionData } from '../../../helpers/common';
import { IHistoricDataFeed } from '../../../../../typechain/contracts/test/consumers/historic/HistoricConsumer';

export abstract class HistoricDataFeedStoreConsumerBaseWrapper<
    U extends BaseContract,
  >
  extends DataFeedStoreConsumerBaseWrapper<U>
  implements IHistoricConsumerWrapper<HistoricConsumer, U>
{
  public override contract!: HistoricConsumer;
  public override wrapper!: IHistoricWrapper<U>;

  public override async checkSetValues(
    keys: number[],
    values: string[],
  ): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const data = await this.contract.getFeedById(keys[i]);
      const parsedData = this.getParsedData(data);
      expect(parsedData.value).to.be.eq(values[i]);
    }
    await this.wrapper.checkSetValues(keys, values);
  }

  public async checkSetTimestamps(
    keys: number[],
    blockNumbers: number[],
  ): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const data = await this.contract.getFeedById(keys[i]);
      const parsedData = this.getParsedData(data);

      expect(parsedData.timestamp).to.be.eq(
        (await ethers.provider.getBlock(blockNumbers[i]))?.timestamp,
      );
    }
    await this.wrapper.checkSetTimestamps(keys, blockNumbers);
  }

  public async checkLatestCounter(
    key: number,
    expectedCounter: number,
  ): Promise<void> {
    const counter = await this.contract.counters(key);
    expect(counter).to.be.eq(expectedCounter);

    await this.wrapper.checkLatestCounter(key, expectedCounter);
  }

  public async checkValueAtCounter(
    key: number,
    counter: number,
    value: string,
    blockNumber: number,
  ): Promise<void> {
    const data = await this.contract.getFeedAtCounter(key, counter);
    const parsedData = this.getParsedData(data);

    expect(parsedData.value).to.be.eq(value);
    expect(parsedData.timestamp).to.be.eq(
      (await ethers.provider.getBlock(blockNumber))?.timestamp,
    );

    await this.wrapper.checkValueAtCounter(key, counter, value, blockNumber);
  }

  public async setMultipleFeedsAtCounter(
    keys: number[],
    counters: number[],
  ): Promise<any> {
    return this.contract.setMultipleFeedsAtCounter(keys, counters);
  }

  public async setMultipleLatestFeedsById(keys: number[]) {
    return this.contract.setMultipleLatestFeedsById(keys);
  }

  public getParsedData(
    data: IHistoricDataFeed.TransmissionStructOutput,
  ): TransmissionData {
    const value = data[0].slice(0, 48).padEnd(66, '0');

    return {
      value,
      timestamp: data[1],
    };
  }
}
