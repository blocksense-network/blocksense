import { DataFeedV1Consumer } from '../../../../../typechain';
import { DataFeed, deployContract } from '../../helpers/common';
import { DataFeedStoreV1Wrapper } from '../basic/V1';
import { DataFeedStoreConsumerBaseWrapper } from './Base';

export class DataFeedStoreConsumerV1Wrapper extends DataFeedStoreConsumerBaseWrapper<DataFeed> {
  public override async init() {
    this.wrapper = new DataFeedStoreV1Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<DataFeedV1Consumer>(
      'DataFeedV1Consumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'DataFeedV1Consumer';
  }
}
