import {
  HistoricDataFeedStoreV1,
  UpgradeableProxy,
} from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { HistoricDataFeedStoreV1Wrapper } from '../../historic/V1';
import { UpgradeableProxyHistoricBaseWrapper } from './Base';

export class UpgradeableProxyHistoricDataFeedStoreV1Wrapper extends UpgradeableProxyHistoricBaseWrapper<
  HistoricDataFeedStoreV1,
  HistoricDataFeedStoreV1Wrapper
> {
  public override async init(...args: any[]) {
    this.implementation = new HistoricDataFeedStoreV1Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyHistoricDataFeedStoreV1';
  }
}
