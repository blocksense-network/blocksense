import {
  HistoricDataFeedStoreGenericV1,
  HistoricDataFeedStoreGenericV1__factory,
} from '../../../../typechain';
import { HistoricDataFeedStoreGenericBaseWrapper } from './WrapperGenericBase';
import { TransmissionData, deployContract } from '../../helpers/common';
import { ethers } from 'hardhat';

export class HistoricDataFeedStoreGenericV1Wrapper extends HistoricDataFeedStoreGenericBaseWrapper {
  constructor() {
    super(
      HistoricDataFeedStoreGenericV1__factory.createInterface().getFunction(
        'setFeeds',
      ).selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<HistoricDataFeedStoreGenericV1>(
      'HistoricDataFeedStoreGenericV1',
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
    return 'HistoricDataFeedStoreGenericV1';
  }

  public override getParsedData(data: string): TransmissionData {
    const value = data.slice(0, 48).padEnd(66, '0');
    const timestamp = ethers.toBigInt('0x' + data.slice(48, data.length));

    return { value, timestamp };
  }
}
