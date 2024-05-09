import {
  HistoricDataFeedStoreV2,
  UpgradeableProxy,
} from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { HistoricDataFeedStoreV2Wrapper } from '../../historic/V2';
import { UpgradeableProxyHistoricBaseWrapper } from './Base';

export class UpgradeableProxyHistoricDataFeedStoreV2Wrapper extends UpgradeableProxyHistoricBaseWrapper<
  HistoricDataFeedStoreV2,
  HistoricDataFeedStoreV2Wrapper
> {
  public override async init(...args: any[]) {
    this.implementation = new HistoricDataFeedStoreV2Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyHistoricDataFeedStoreV2';
  }
}
