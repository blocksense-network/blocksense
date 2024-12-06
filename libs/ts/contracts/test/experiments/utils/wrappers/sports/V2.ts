import {
  IDataFeedStore__factory,
  SportsDataFeedStoreV2,
} from '../../../../../typechain';
import { deployContract } from '../../helpers/common';
import { SportsDataFeedStoreBaseWrapper } from './Base';

export class SportsDataFeedStoreV2Wrapper extends SportsDataFeedStoreBaseWrapper<SportsDataFeedStoreV2> {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<SportsDataFeedStoreV2>(
      'SportsDataFeedStoreV2',
    );
  }

  public override getName(): string {
    return 'SportsDataFeedStoreV2';
  }
}
