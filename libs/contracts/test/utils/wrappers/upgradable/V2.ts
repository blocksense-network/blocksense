import { DataFeedStoreV2, UpgradeableProxy } from '../../../../typechain';
import { deployContract } from '../../helpers/common';
import { DataFeedStoreV2Wrapper } from '../dataFeedStore/V2';
import { UpgradeableProxyBaseWrapper } from './Base';

export class UpgradeableProxyDataFeedStoreV2Wrapper extends UpgradeableProxyBaseWrapper<
  DataFeedStoreV2,
  DataFeedStoreV2Wrapper
> {
  public override async init(...args: any[]) {
    this.implementation = new DataFeedStoreV2Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyDataFeedStoreV2';
  }
}
