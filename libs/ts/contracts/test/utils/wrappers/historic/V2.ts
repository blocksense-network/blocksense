import { ethers } from 'hardhat';
import {
  HistoricDataFeedStoreV2,
  IDataFeedStore__factory,
} from '../../../../typechain';
import { deployContract } from '../../helpers/common';
import { HistoricDataFeedStoreWrapper } from './WrapperBase';

export class HistoricDataFeedStoreV2Wrapper extends HistoricDataFeedStoreWrapper {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<HistoricDataFeedStoreV2>(
      'HistoricDataFeedStoreV2',
      (await ethers.getSigners())[0].address,
    );
  }

  public override getName(): string {
    return 'HistoricDataFeedStoreV2';
  }
}
