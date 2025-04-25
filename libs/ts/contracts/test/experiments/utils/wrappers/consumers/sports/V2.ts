import {
  SportsConsumer,
  SportsDataFeedStoreV2,
} from '../../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { SportsDataFeedStoreV2Wrapper } from '../../sports/V2';
import { SportsDataFeedStoreConsumerBaseWrapper } from './Base';

export class SportsDataFeedStoreConsumerV2Wrapper extends SportsDataFeedStoreConsumerBaseWrapper<SportsDataFeedStoreV2> {
  public override async init() {
    this.wrapper = new SportsDataFeedStoreV2Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<SportsConsumer>(
      'SportsConsumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'SportsV2Consumer';
  }
}
