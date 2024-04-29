import { DataFeedV2Consumer } from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { DataFeedStoreV2Wrapper } from '../../dataFeedStore/V2';
import { DataFeedStoreConsumerBaseWrapper } from './Base';

export class DataFeedStoreConsumerV2Wrapper extends DataFeedStoreConsumerBaseWrapper {
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
