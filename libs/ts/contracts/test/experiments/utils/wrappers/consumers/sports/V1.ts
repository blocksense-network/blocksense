import {
  SportsConsumer,
  SportsDataFeedStoreV1,
} from '../../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { SportsDataFeedStoreV1Wrapper } from '../../sports/V1';
import { SportsDataFeedStoreConsumerBaseWrapper } from './Base';

export class SportsDataFeedStoreConsumerV1Wrapper extends SportsDataFeedStoreConsumerBaseWrapper<SportsDataFeedStoreV1> {
  public override async init() {
    this.wrapper = new SportsDataFeedStoreV1Wrapper();
    await this.wrapper.init();

    this.contract = await deployContract<SportsConsumer>(
      'SportsConsumer',
      this.wrapper.contract.target,
    );
  }

  public override getName(): string {
    return 'SportsV1Consumer';
  }
}
