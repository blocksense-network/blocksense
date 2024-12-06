import { DataFeedStoreV1, UpgradeableProxy } from '../../../../../typechain';
import { deployContract } from '../../helpers/common';
import { DataFeedStoreV1Wrapper } from '../basic/V1';
import { UpgradeableProxyBaseWrapper } from './Base';

export class UpgradeableProxyDataFeedStoreV1Wrapper extends UpgradeableProxyBaseWrapper<DataFeedStoreV1> {
  public override async init(...args: any[]) {
    this.implementation = new DataFeedStoreV1Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyDataFeedStoreV1';
  }
}
