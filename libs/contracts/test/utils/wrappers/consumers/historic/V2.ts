import { HistoricDataFeedConsumer } from '../../../../../typechain';
import { HistoricDataFeedStore, deployContract } from '../../../helpers/common';
import { HistoricDataFeedStoreV2Wrapper } from '../../historicDataFeedStore/V2';
import { HistoricDataFeedStoreConsumerBaseWrapper } from './Base';

export class HistoricDataFeedStoreConsumerV2Wrapper extends HistoricDataFeedStoreConsumerBaseWrapper<HistoricDataFeedStore> {
  public override async init() {
    this.wrapper = new HistoricDataFeedStoreV2Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<HistoricDataFeedConsumer>(
      'HistoricDataFeedConsumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'HistoricDataFeedV2Consumer';
  }
}
