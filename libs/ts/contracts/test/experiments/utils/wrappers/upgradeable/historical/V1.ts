import {
  HistoricalDataFeedStoreV1,
  UpgradeableProxy,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../../helpers/common';
import { HistoricalDataFeedStoreV1Wrapper } from '../../historical/V1';
import { UpgradeableProxyHistoricalBaseWrapper } from './Base';

export class UpgradeableProxyHistoricalDataFeedStoreV1Wrapper extends UpgradeableProxyHistoricalBaseWrapper<HistoricalDataFeedStoreV1> {
  public override async init(...args: any[]) {
    this.implementation = new HistoricalDataFeedStoreV1Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyHistoricalDataFeedStoreV1';
  }
}
