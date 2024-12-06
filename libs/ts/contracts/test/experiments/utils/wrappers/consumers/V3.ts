import { DataFeedV2Consumer } from '../../../../../typechain';
import { DataFeed, deployContract } from '../../helpers/common';
import { DataFeedStoreV3Wrapper } from '../basic/V3';
import { DataFeedStoreConsumerBaseWrapper } from './Base';

export class DataFeedStoreConsumerV3Wrapper extends DataFeedStoreConsumerBaseWrapper<DataFeed> {
  public override async init() {
    this.wrapper = new DataFeedStoreV3Wrapper();
    await this.wrapper.init();

    // ConsumerV2 is the same for v2 and v3 wrappers as they have the same interface
    this.contract = await deployContract<DataFeedV2Consumer>(
      'DataFeedV2Consumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'DataFeedV3Consumer';
  }
}
