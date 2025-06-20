import {
  HistoricalDataFeedStoreV2,
  UpgradeableProxy,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../../helpers/common';
import { HistoricalDataFeedStoreV2Wrapper } from '../../historical/V2';
import { UpgradeableProxyHistoricalBaseWrapper } from './Base';

export class UpgradeableProxyHistoricalDataFeedStoreV2Wrapper extends UpgradeableProxyHistoricalBaseWrapper<HistoricalDataFeedStoreV2> {
  public override async init(...args: any[]) {
    this.implementation = new HistoricalDataFeedStoreV2Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyHistoricalDataFeedStoreV2';
  }
}
