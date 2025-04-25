import { ethers } from 'hardhat';
import {
  HistoricalDataFeedStoreV2,
  IDataFeedStore__factory,
} from '../../../../../typechain';
import { deployContract } from '../../helpers/common';
import { HistoricalDataFeedStoreWrapper } from './WrapperBase';

export class HistoricalDataFeedStoreV2Wrapper extends HistoricalDataFeedStoreWrapper {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<HistoricalDataFeedStoreV2>(
      'HistoricalDataFeedStoreV2',
      (await ethers.getSigners())[0].address,
    );
  }

  public override getName(): string {
    return 'HistoricalDataFeedStoreV2';
  }
}
