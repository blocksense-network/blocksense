import {
  SportsDataFeedStoreGenericV1,
  SportsDataFeedStoreGenericV1__factory,
} from '../../../../../typechain';
import { deployContract } from '../../helpers/common';
import { SportsDataFeedStoreBaseWrapper } from './Base';

export class SportsDataFeedStoreGenericV1Wrapper extends SportsDataFeedStoreBaseWrapper<SportsDataFeedStoreGenericV1> {
  constructor() {
    super(
      SportsDataFeedStoreGenericV1__factory.createInterface().getFunction(
        'setFeeds',
      ).selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<SportsDataFeedStoreGenericV1>(
      'SportsDataFeedStoreGenericV1',
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
    const res = await this.contract.getDataFeed(
      decodedFunctionData[0],
      decodedFunctionData[1],
    );

    return (
      res[0] +
      res
        .slice(1)
        .map(v => v.slice(2))
        .join('')
    );
  }

  public override getLatestValueData(key: number, slotsPerKey: number): string {
    return this.contract.interface.encodeFunctionData('getDataFeed', [
      key,
      slotsPerKey,
    ]);
  }

  public override getName(): string {
    return 'SportsDataFeedStoreGenericV1';
  }
}
