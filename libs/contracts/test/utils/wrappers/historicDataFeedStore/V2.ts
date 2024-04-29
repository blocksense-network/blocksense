import {
  HistoricDataFeedStoreV2,
  IDataFeedStore__factory,
} from '../../../../typechain';
import { deployContract } from '../../helpers/common';
import { HistoricDataFeedStoreBaseWrapper } from './Base';

export class HistoricDataFeedStoreV2Wrapper extends HistoricDataFeedStoreBaseWrapper {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<HistoricDataFeedStoreV2>(
      'HistoricDataFeedStoreV2',
    );
  }

  public override getName(): string {
    return 'HistoricDataFeedStoreV2';
  }
}
