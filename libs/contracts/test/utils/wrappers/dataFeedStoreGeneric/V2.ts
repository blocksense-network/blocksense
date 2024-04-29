import { Typed, ethers } from 'ethers';
import {
  DataFeedStoreGenericV2,
  DataFeedStoreGenericV2__factory,
} from '../../../../typechain';
import { DataFeedStoreGenericBaseWrapper } from './Base';
import { deployContract } from '../../helpers/common';

export class DataFeedStoreGenericV2Wrapper extends DataFeedStoreGenericBaseWrapper {
  constructor() {
    super(
      DataFeedStoreGenericV2__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<DataFeedStoreGenericV2>(
      'DataFeedStoreGenericV2',
    );
  }

  public override async setFeeds(
    keys: number[],
    values: string[],
  ): Promise<any> {
    return (
      await this.contract.setFeeds(
        ethers.solidityPacked(
          keys.map(() => ['uint32', 'bytes32']).flat(),
          keys.flatMap((key, i) => [key, values[i]]),
        ),
      )
    ).wait();
  }

  public override getName(): string {
    return 'DataFeedStoreGenericV2';
  }
}
