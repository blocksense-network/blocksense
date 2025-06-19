import {
  DataFeedStoreGenericV2,
  DataFeedStoreGenericV2__factory,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../helpers/common';
import { ethers } from 'hardhat';
import { DataFeedStoreBaseWrapper } from './Base';

export class DataFeedStoreGenericV2Wrapper extends DataFeedStoreBaseWrapper<DataFeedStoreGenericV2> {
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

  public override customSetFeedsData(
    _: string,
    keys: number[],
    values: string[],
  ): string {
    return this.contract.interface.encodeFunctionData('setFeeds', [
      ethers.solidityPacked(
        [...keys.map(() => ['uint32', 'bytes32']).flat()],
        [...keys.flatMap((key, i) => [key, values[i]])],
      ),
    ]);
  }

  public override getLatestValueData(key: number): string {
    return this.contract.interface.encodeFunctionData('getDataFeed', [key]);
  }

  public override getName(): string {
    return 'DataFeedStoreGenericV2';
  }
}
