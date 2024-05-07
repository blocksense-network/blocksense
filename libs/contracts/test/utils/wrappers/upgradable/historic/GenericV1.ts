import {
  HistoricDataFeedStoreGenericV1,
  UpgradeableProxy,
} from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { HistoricDataFeedStoreGenericV1Wrapper } from '../../historicDataFeedStore/GenericV1';
import { UpgradeableProxyHistoricBaseWrapper } from './Base';

export class UpgradeableProxyHistoricDataFeedStoreGenericV1Wrapper extends UpgradeableProxyHistoricBaseWrapper<
  HistoricDataFeedStoreGenericV1,
  HistoricDataFeedStoreGenericV1Wrapper
> {
  public override async init(...args: any[]) {
    this.implementation = new HistoricDataFeedStoreGenericV1Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyHistoricDataFeedStoreGenericV1';
  }
}
