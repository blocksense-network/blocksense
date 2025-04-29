import { GenericHistoricalDataFeedStore } from '../../helpers/common';
import { HistoricalDataFeedStoreBaseWrapper } from './Base';

export abstract class HistoricalDataFeedStoreGenericBaseWrapper extends HistoricalDataFeedStoreBaseWrapper {
  public declare contract: GenericHistoricalDataFeedStore;

  public override getLatestValueData(key: number): string {
    return this.contract.interface.encodeFunctionData('getDataFeed', [key]);
  }

  public override getLatestCounterData(key: number): string {
    return this.contract.interface.encodeFunctionData('getLatestCounter', [
      key,
    ]);
  }

  public override getValueAtCounterData(key: number, counter: number): string {
    return this.contract.interface.encodeFunctionData('getFeedAtCounter', [
      key,
      counter,
    ]);
  }
}
