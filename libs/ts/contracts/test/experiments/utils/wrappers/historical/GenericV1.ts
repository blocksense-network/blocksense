import {
  HistoricalDataFeedStoreGenericV1,
  HistoricalDataFeedStoreGenericV1__factory,
} from '@blocksense/contracts/typechain';
import { HistoricalDataFeedStoreGenericBaseWrapper } from './WrapperGenericBase';
import { TransmissionData, deployContract } from '../../helpers/common';
import { ethers } from 'hardhat';

export class HistoricalDataFeedStoreGenericV1Wrapper extends HistoricalDataFeedStoreGenericBaseWrapper {
  constructor() {
    super(
      HistoricalDataFeedStoreGenericV1__factory.createInterface().getFunction(
        'setFeeds',
      ).selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<HistoricalDataFeedStoreGenericV1>(
      'HistoricalDataFeedStoreGenericV1',
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

  public override getName(): string {
    return 'HistoricalDataFeedStoreGenericV1';
  }

  public override getParsedData(data: string): TransmissionData {
    const value = data.slice(0, 48).padEnd(66, '0');
    const timestamp = ethers.toBigInt('0x' + data.slice(48, data.length));

    return { value, timestamp };
  }
}
