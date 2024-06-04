import { GenericDataFeedStore, deployContract } from '../../helpers/common';
import { UpgradeableProxyBaseWrapper } from './Base';
import { UpgradeableProxy } from '../../../../typechain';
import { DataFeedStoreGenericV2Wrapper } from '../dataFeedStore/GenericV2';

export class UpgradeableProxyDataFeedStoreV2GenericWrapper extends UpgradeableProxyBaseWrapper<
  GenericDataFeedStore,
  DataFeedStoreGenericV2Wrapper
> {
  public override async init(...args: any[]) {
    this.implementation = new DataFeedStoreGenericV2Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyDataFeedStoreGenericV2';
  }
}
