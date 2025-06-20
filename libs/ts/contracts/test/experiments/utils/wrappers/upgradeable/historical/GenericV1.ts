import {
  HistoricalDataFeedStoreGenericV1,
  UpgradeableProxy,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../../helpers/common';
import { HistoricalDataFeedStoreGenericV1Wrapper } from '../../historical/GenericV1';
import { UpgradeableProxyHistoricalBaseWrapper } from './Base';

export class UpgradeableProxyHistoricalDataFeedStoreGenericV1Wrapper extends UpgradeableProxyHistoricalBaseWrapper<HistoricalDataFeedStoreGenericV1> {
  public override async init(...args: any[]) {
    this.implementation = new HistoricalDataFeedStoreGenericV1Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyHistoricalDataFeedStoreGenericV1';
  }
}
