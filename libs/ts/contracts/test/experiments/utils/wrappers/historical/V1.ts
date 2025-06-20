import { ethers } from 'hardhat';
import {
  HistoricalDataFeedStoreV1,
  IDataFeedStore__factory,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../helpers/common';
import { HistoricalDataFeedStoreWrapper } from './WrapperBase';

export class HistoricalDataFeedStoreV1Wrapper extends HistoricalDataFeedStoreWrapper {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<HistoricalDataFeedStoreV1>(
      'HistoricalDataFeedStoreV1',
      (await ethers.getSigners())[0].address,
    );
  }

  public override getName(): string {
    return 'HistoricalDataFeedStoreV1';
  }
}
