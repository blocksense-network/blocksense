import {
  SportsDataFeedStoreGenericV1,
  SportsGenericV1Consumer,
} from '../../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { SportsDataFeedStoreGenericV1Wrapper } from '../../sports/GenericV1';
import { SportsDataFeedStoreConsumerBaseWrapper } from './Base';

export class SportsDataFeedStoreGenericConsumerV1Wrapper extends SportsDataFeedStoreConsumerBaseWrapper<SportsDataFeedStoreGenericV1> {
  public override async init() {
    this.wrapper = new SportsDataFeedStoreGenericV1Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<SportsGenericV1Consumer>(
      'SportsGenericV1Consumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'SportsGenericV1Consumer';
  }
}
