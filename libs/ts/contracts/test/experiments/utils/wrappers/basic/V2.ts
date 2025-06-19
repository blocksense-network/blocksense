import {
  DataFeedStoreV2,
  IDataFeedStore__factory,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../helpers/common';
import { DataFeedStoreBaseWrapper } from './Base';

export class DataFeedStoreV2Wrapper extends DataFeedStoreBaseWrapper<DataFeedStoreV2> {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<DataFeedStoreV2>('DataFeedStoreV2');
  }

  public override getLatestValueData(key: number): string {
    return '0x' + ((key | 0x80000000) >>> 0).toString(16).padStart(8, '0');
  }

  public override getName(): string {
    return 'DataFeedStoreV2';
  }
}
