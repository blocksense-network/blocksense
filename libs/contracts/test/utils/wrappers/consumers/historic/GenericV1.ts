import { HistoricDataFeedGenericConsumer } from '../../../../../typechain';
import {
  GenericHistoricDataFeedStore,
  deployContract,
} from '../../../helpers/common';
import { HistoricDataFeedStoreGenericV1Wrapper } from '../../historic/GenericV1';
import { HistoricDataFeedStoreConsumerBaseWrapper } from './Base';

export class HistoricDataFeedStoreGenericConsumerV1Wrapper extends HistoricDataFeedStoreConsumerBaseWrapper<GenericHistoricDataFeedStore> {
  public override async init() {
    this.wrapper = new HistoricDataFeedStoreGenericV1Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<HistoricDataFeedGenericConsumer>(
      'HistoricDataFeedGenericConsumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'HistoricDataFeedGenericV1Consumer';
  }
}
