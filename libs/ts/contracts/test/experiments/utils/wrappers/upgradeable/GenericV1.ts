import { UpgradeableProxy } from '@blocksense/contracts/typechain';
import { GenericDataFeedStore, deployContract } from '../../helpers/common';
import { UpgradeableProxyBaseWrapper } from './Base';
import { DataFeedStoreGenericV1Wrapper } from '../basic/GenericV1';

export class UpgradeableProxyDataFeedStoreV1GenericWrapper extends UpgradeableProxyBaseWrapper<GenericDataFeedStore> {
  public override async init(...args: any[]) {
    this.implementation = new DataFeedStoreGenericV1Wrapper();
    await this.implementation.init();

    this.contract = await deployContract<UpgradeableProxy>(
      'UpgradeableProxy',
      this.implementation.contract.target,
      ...args,
    );
  }

  public override getName(): string {
    return 'UpgradeableProxyDataFeedStoreGenericV1';
  }
}
