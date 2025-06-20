import { DataFeedV2Consumer } from '@blocksense/contracts/typechain';
import { deployContract } from '../../helpers/common';
import { DataFeedStoreV2Wrapper } from '../basic/V2';
import { DataFeed } from '../../helpers/common';
import { DataFeedStoreConsumerBaseWrapper } from './Base';

export class DataFeedStoreConsumerV2Wrapper extends DataFeedStoreConsumerBaseWrapper<DataFeed> {
  public override async init() {
    this.wrapper = new DataFeedStoreV2Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<DataFeedV2Consumer>(
      'DataFeedV2Consumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'DataFeedV2Consumer';
  }
}
