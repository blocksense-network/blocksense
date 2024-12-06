import { HistoricalDataFeedConsumer } from '../../../../../../typechain';
import {
  HistoricalDataFeedStore,
  deployContract,
} from '../../../helpers/common';
import { HistoricalDataFeedStoreV2Wrapper } from '../../historical/V2';
import { HistoricalDataFeedStoreConsumerBaseWrapper } from './Base';

export class HistoricalDataFeedStoreConsumerV2Wrapper extends HistoricalDataFeedStoreConsumerBaseWrapper<HistoricalDataFeedStore> {
  public override async init() {
    this.wrapper = new HistoricalDataFeedStoreV2Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<HistoricalDataFeedConsumer>(
      'HistoricalDataFeedConsumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'HistoricalDataFeedV2Consumer';
  }
}
