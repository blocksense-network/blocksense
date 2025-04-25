import { HistoricalDataFeedGenericConsumer } from '../../../../../../typechain';
import {
  GenericHistoricalDataFeedStore,
  deployContract,
} from '../../../helpers/common';
import { HistoricalDataFeedStoreGenericV1Wrapper } from '../../historical/GenericV1';
import { HistoricalDataFeedStoreConsumerBaseWrapper } from './Base';

export class HistoricalDataFeedStoreGenericConsumerV1Wrapper extends HistoricalDataFeedStoreConsumerBaseWrapper<GenericHistoricalDataFeedStore> {
  public override async init() {
    this.wrapper = new HistoricalDataFeedStoreGenericV1Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<HistoricalDataFeedGenericConsumer>(
      'HistoricalDataFeedGenericConsumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'HistoricalDataFeedGenericV1Consumer';
  }
}
