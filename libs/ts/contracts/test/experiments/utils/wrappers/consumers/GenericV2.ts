import { DataFeedGenericV2Consumer } from '@blocksense/contracts/typechain';
import { GenericDataFeedStore, deployContract } from '../../helpers/common';
import { DataFeedStoreGenericV2Wrapper } from '../basic/GenericV2';
import { DataFeedStoreConsumerBaseWrapper } from './Base';

export class DataFeedStoreGenericConsumerV2Wrapper extends DataFeedStoreConsumerBaseWrapper<GenericDataFeedStore> {
  public override async init() {
    this.wrapper = new DataFeedStoreGenericV2Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<DataFeedGenericV2Consumer>(
      'DataFeedGenericV2Consumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'DataFeedGenericV2Consumer';
  }
}
