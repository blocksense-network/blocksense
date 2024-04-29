import { ethers } from 'hardhat';
import { DataFeedStoreBaseWrapper } from '../dataFeedStore/Base';
import { expect } from 'chai';

enum HISTORIC_SELECTORS {
  GET_LATEST_VALUE = 0x80000000,
  GET_LATEST_COUNTER = 0x40000000,
  GET_VALUE_AT_COUNTER = 0x20000000,
}

export abstract class HistoricDataFeedStoreBaseWrapper extends DataFeedStoreBaseWrapper {
  public async checkSetValues(keys: number[], values: string[]): Promise<void> {
    for (const [index, key] of keys.entries()) {
      const storedValue = await this.getValue(
        this.getHistoricSelector(HISTORIC_SELECTORS.GET_LATEST_VALUE, key),
      );

      const data = storedValue.slice(0, 48).padEnd(66, '0');
      expect(data).to.equal(values[index]);
    }
  }

  public async checkSetTimestamps(
    keys: number[],
    blockNumbers: number[],
  ): Promise<void> {
    for (const [index, key] of keys.entries()) {
      const storedValue = await this.getValue(
        this.getHistoricSelector(HISTORIC_SELECTORS.GET_LATEST_VALUE, key),
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
  ): Promise<void> {
    const historicSelector = this.getHistoricSelector(
      HISTORIC_SELECTORS.GET_LATEST_COUNTER,
      key,
    );
    const counter = await this.getValue(historicSelector);

    expect(+counter).to.equal(expectedCounter);
  }

  public async checkValueAtCounter(
    key: number,
    counter: number,
    value: string,
    blockNumber: number,
  ): Promise<void> {
    const historicSelector = this.getHistoricSelector(
      HISTORIC_SELECTORS.GET_VALUE_AT_COUNTER,
      key,
    );
    const storedValue = await this.getValue(historicSelector, {
      data: ethers.solidityPacked(
        ['bytes4', 'uint256'],
        [historicSelector, counter],
      ),
    });

    const data = storedValue.slice(0, 48).padEnd(66, '0');
    const timestamp = ethers.toNumber(
      '0x' + storedValue.slice(48, storedValue.length),
    );

    expect(data).to.equal(value);
    expect(timestamp).to.equal(
      (await ethers.provider.getBlock(blockNumber))?.timestamp,
    );
  }

  public override getLatestValueSelector(key: number): string {
    return this.getHistoricSelector(HISTORIC_SELECTORS.GET_LATEST_VALUE, key);
  }

  public getLatestCounterSelector(key: number): string {
    return this.getHistoricSelector(HISTORIC_SELECTORS.GET_LATEST_COUNTER, key);
  }

  public getValueAtCounterSelector(key: number): string {
    return this.getHistoricSelector(
      HISTORIC_SELECTORS.GET_VALUE_AT_COUNTER,
      key,
    );
  }

  protected getHistoricSelector = (
    type: HISTORIC_SELECTORS,
    key: number,
  ): string => {
    return '0x' + ((key | type) >>> 0).toString(16).padStart(8, '0');
  };
}
