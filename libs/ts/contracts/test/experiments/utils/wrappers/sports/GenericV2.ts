import {
  SportsDataFeedStoreGenericV2,
  SportsDataFeedStoreGenericV2__factory,
} from '../../../../../typechain';
import { deployContract } from '../../helpers/common';
import { SportsDataFeedStoreBaseWrapper } from './Base';

export class SportsDataFeedStoreGenericV2Wrapper extends SportsDataFeedStoreBaseWrapper<SportsDataFeedStoreGenericV2> {
  constructor() {
    super(
      SportsDataFeedStoreGenericV2__factory.createInterface().getFunction(
        'setFeeds',
      ).selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<SportsDataFeedStoreGenericV2>(
      'SportsDataFeedStoreGenericV2',
    );
  }

  public override customSetFeedsData(
    _: string,
    keys: number[],
    values: string[],
    descriptions: string[],
  ): string {
    return this.contract.interface.encodeFunctionData('setFeeds', [
      keys,
      values.map(v => v.split(';')),
      descriptions,
    ]);
  }

  public override async getValue(data: string): Promise<string> {
    const decodedFunctionData = this.contract.interface.decodeFunctionData(
      'getDataFeed',
      data,
    );
    const res = await this.contract.getDataFeed(decodedFunctionData[0]);

    return (
      res[0] +
      res
        .slice(1)
        .map(v => v.slice(2))
        .join('')
    );
  }

  public override getLatestValueData(key: number): string {
    return this.contract.interface.encodeFunctionData('getDataFeed', [key]);
  }

  public override getName(): string {
    return 'SportsDataFeedStoreGenericV2';
  }
}
