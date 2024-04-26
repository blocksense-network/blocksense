import { Typed } from 'ethers';
import {
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV1__factory,
} from '../../../../typechain';
import { DataFeedStoreGenericWrapper } from './Base';
import { deployContract } from '../../helpers/common';

export class DataFeedStoreGenericV1Wrapper extends DataFeedStoreGenericWrapper {
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
