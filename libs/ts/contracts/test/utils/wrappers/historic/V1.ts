import { ethers } from 'hardhat';
import {
  HistoricDataFeedStoreV1,
  IDataFeedStore__factory,
} from '../../../../typechain';
import { deployContract } from '../../helpers/common';
import { HistoricDataFeedStoreWrapper } from './WrapperBase';

export class HistoricDataFeedStoreV1Wrapper extends HistoricDataFeedStoreWrapper {
  constructor() {
    super(
      IDataFeedStore__factory.createInterface().getFunction('setFeeds')
        .selector,
    );
  }

  public override async init() {
    this.contract = await deployContract<HistoricDataFeedStoreV1>(
      'HistoricDataFeedStoreV1',
      (await ethers.getSigners())[0].address,
    );
  }

  public override getName(): string {
    return 'HistoricDataFeedStoreV1';
  }
}
