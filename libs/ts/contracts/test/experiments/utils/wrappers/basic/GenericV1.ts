import {
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV1__factory,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../helpers/common';
import { DataFeedStoreBaseWrapper } from './Base';

export class DataFeedStoreGenericV1Wrapper extends DataFeedStoreBaseWrapper<DataFeedStoreGenericV1> {
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

  public override customSetFeedsData(
    _: string,
    keys: number[],
    values: string[],
  ): string {
    return this.contract.interface.encodeFunctionData('setFeeds', [
      keys,
      values,
    ]);
  }

  public override getLatestValueData(key: number): string {
    return this.contract.interface.encodeFunctionData('getDataFeed', [key]);
  }

  public override getName(): string {
    return 'DataFeedStoreGenericV1';
  }
}
