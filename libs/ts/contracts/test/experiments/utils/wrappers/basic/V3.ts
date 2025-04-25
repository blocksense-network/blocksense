import {
  DataFeedStoreV3,
  IDataFeedStore__factory,
} from '../../../../../typechain';
import { deployContract } from '../../helpers/common';
import { DataFeedStoreBaseWrapper } from './Base';

export class DataFeedStoreV3Wrapper extends DataFeedStoreBaseWrapper<DataFeedStoreV3> {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<DataFeedStoreV3>('DataFeedStoreV3');
  }

  public override getLatestValueData(key: number): string {
    return '0x' + ((key | 0x80000000) >>> 0).toString(16).padStart(8, '0');
  }

  public override getName(): string {
    return 'DataFeedStoreV3';
  }
}
