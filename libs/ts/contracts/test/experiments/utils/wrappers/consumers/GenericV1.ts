import { DataFeedGenericV1Consumer } from '../../../../../typechain';
import { GenericDataFeedStore, deployContract } from '../../helpers/common';
import { DataFeedStoreGenericV1Wrapper } from '../basic/GenericV1';
import { DataFeedStoreConsumerBaseWrapper } from './Base';

export class DataFeedStoreGenericConsumerV1Wrapper extends DataFeedStoreConsumerBaseWrapper<GenericDataFeedStore> {
  public override async init() {
    this.wrapper = new DataFeedStoreGenericV1Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<DataFeedGenericV1Consumer>(
      'DataFeedGenericV1Consumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'DataFeedGenericV1Consumer';
  }
}
