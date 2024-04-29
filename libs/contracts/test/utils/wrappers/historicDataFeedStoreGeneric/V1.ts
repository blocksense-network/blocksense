import {
  HistoricDataFeedStoreGenericV1,
  HistoricDataFeedStoreGenericV1__factory,
} from '../../../../typechain';
import { HistoricDataFeedStoreGenericBaseWrapper } from './Base';
import { deployContract } from '../../helpers/common';

export class HistoricDataFeedStoreGenericV1Wrapper extends HistoricDataFeedStoreGenericBaseWrapper {
  constructor() {
    super(
      HistoricDataFeedStoreGenericV1__factory.createInterface().getFunction(
        'setFeeds',
      ).selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<HistoricDataFeedStoreGenericV1>(
      'HistoricDataFeedStoreGenericV1',
    );
  }

  public override async setFeeds(
    keys: number[],
    values: string[],
  ): Promise<any> {
    return (await this.contract.setFeeds(keys, values)).wait();
  }

  public override getName(): string {
    return 'HistoricDataFeedStoreGenericV1';
  }
}
