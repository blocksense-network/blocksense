import {
  DataFeedStoreV1,
  IDataFeedStore__factory,
} from '../../../../../typechain';
import { deployContract } from '../../helpers/common';
import { DataFeedStoreBaseWrapper } from './Base';

export class DataFeedStoreV1Wrapper extends DataFeedStoreBaseWrapper<DataFeedStoreV1> {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<DataFeedStoreV1>('DataFeedStoreV1');
  }

  public override getLatestValueData(key: number): string {
    return '0x' + (key >>> 0).toString(16).padStart(8, '0');
  }

  public override getName(): string {
    return 'DataFeedStoreV1';
  }
}
