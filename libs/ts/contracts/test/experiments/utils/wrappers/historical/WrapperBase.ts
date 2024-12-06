import { ethers } from 'hardhat';
import { HistoricalDataFeedStoreBaseWrapper } from './Base';

enum HISTORICAL_SELECTORS {
  GET_LATEST_VALUE = 0x80000000,
  GET_LATEST_COUNTER = 0x40000000,
  GET_VALUE_AT_COUNTER = 0x20000000,
}

export abstract class HistoricalDataFeedStoreWrapper extends HistoricalDataFeedStoreBaseWrapper {
  public override getLatestValueData(key: number): string {
    return this.getHistoricalSelector(
      HISTORICAL_SELECTORS.GET_LATEST_VALUE,
      key,
    );
  }

  public override getLatestCounterData(key: number): string {
    return this.getHistoricalSelector(
      HISTORICAL_SELECTORS.GET_LATEST_COUNTER,
      key,
    );
  }

  public override getValueAtCounterData(key: number, counter: number): string {
    return ethers.solidityPacked(
      ['bytes4', 'uint256'],
      [
        this.getHistoricalSelector(
          HISTORICAL_SELECTORS.GET_VALUE_AT_COUNTER,
          key,
        ),
        counter,
      ],
    );
  }

  protected getHistoricalSelector = (
    type: HISTORICAL_SELECTORS,
    key: number,
  ): string => {
    return '0x' + ((key | type) >>> 0).toString(16).padStart(8, '0');
  };
}
