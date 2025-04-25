import {
  IDataFeedStore__factory,
  SportsDataFeedStoreV1,
} from '../../../../../typechain';
import { deployContract } from '../../helpers/common';
import { SportsDataFeedStoreBaseWrapper } from './Base';

export class SportsDataFeedStoreV1Wrapper extends SportsDataFeedStoreBaseWrapper<SportsDataFeedStoreV1> {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<SportsDataFeedStoreV1>(
      'SportsDataFeedStoreV1',
    );
  }

  public override getName(): string {
    return 'SportsDataFeedStoreV1';
  }
}
