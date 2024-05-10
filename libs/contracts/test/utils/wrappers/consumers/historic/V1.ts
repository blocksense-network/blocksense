import { HistoricDataFeedConsumerV1 } from '../../../../../typechain';
import { HistoricDataFeedStore, deployContract } from '../../../helpers/common';
import { HistoricDataFeedStoreV1Wrapper } from '../../historic/V1';
import { HistoricDataFeedStoreConsumerBaseWrapper } from './Base';

export class HistoricDataFeedStoreConsumerV1Wrapper extends HistoricDataFeedStoreConsumerBaseWrapper<HistoricDataFeedStore> {
  public override async init() {
    this.wrapper = new HistoricDataFeedStoreV1Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<HistoricDataFeedConsumerV1>(
      'HistoricDataFeedConsumerV1',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'HistoricDataFeedV1Consumer';
  }
}
