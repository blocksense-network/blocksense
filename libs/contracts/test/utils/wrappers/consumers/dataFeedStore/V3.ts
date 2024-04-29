import { DataFeedV2Consumer } from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { DataFeedStoreV3Wrapper } from '../../dataFeedStore/V3';
import { DataFeedStoreConsumerBaseWrapper } from './Base';

export class DataFeedStoreConsumerV3Wrapper extends DataFeedStoreConsumerBaseWrapper {
  public override async init() {
    this.wrapper = new DataFeedStoreV3Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<DataFeedV2Consumer>(
      'DataFeedV2Consumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'DataFeedV3Consumer';
  }
}
