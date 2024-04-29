import {
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV1__factory,
} from '../../../../typechain';
import { DataFeedStoreGenericBaseWrapper } from './Base';
import { deployContract } from '../../helpers/common';

export class DataFeedStoreGenericV1Wrapper extends DataFeedStoreGenericBaseWrapper {
  constructor() {
    super(
      DataFeedStoreGenericV1__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<DataFeedStoreGenericV1>(
      'DataFeedStoreGenericV1',
    );
  }

  public override async setFeeds(
    keys: number[],
    values: string[],
  ): Promise<any> {
    return (await this.contract.setFeeds(keys, values)).wait();
  }

  public override getName(): string {
    return 'DataFeedStoreGenericV1';
  }
}
