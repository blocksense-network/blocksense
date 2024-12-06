import {
  SportsDataFeedStoreGenericV2,
  SportsGenericV2Consumer,
} from '../../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { SportsDataFeedStoreGenericV2Wrapper } from '../../sports/GenericV2';
import { SportsDataFeedStoreConsumerBaseWrapper } from './Base';

export class SportsDataFeedStoreGenericConsumerV2Wrapper extends SportsDataFeedStoreConsumerBaseWrapper<SportsDataFeedStoreGenericV2> {
  public override async init() {
    this.wrapper = new SportsDataFeedStoreGenericV2Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<SportsGenericV2Consumer>(
      'SportsGenericV2Consumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'SportsGenericV2Consumer';
  }
}
