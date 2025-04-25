import { HistoricalDataFeedConsumer } from '../../../../../../typechain';
import {
  HistoricalDataFeedStore,
  deployContract,
} from '../../../helpers/common';
import { HistoricalDataFeedStoreV1Wrapper } from '../../historical/V1';
import { HistoricalDataFeedStoreConsumerBaseWrapper } from './Base';

export class HistoricalDataFeedStoreConsumerV1Wrapper extends HistoricalDataFeedStoreConsumerBaseWrapper<HistoricalDataFeedStore> {
  public override async init() {
    this.wrapper = new HistoricalDataFeedStoreV1Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<HistoricalDataFeedConsumer>(
      'HistoricalDataFeedConsumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'HistoricalDataFeedV1Consumer';
  }
}
