import { GenericHistoricDataFeedStore } from '../../helpers/common';
import { HistoricDataFeedStoreBaseWrapper } from './Base';

export abstract class HistoricDataFeedStoreGenericBaseWrapper extends HistoricDataFeedStoreBaseWrapper {
  public contract!: GenericHistoricDataFeedStore;

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
