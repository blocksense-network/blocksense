import {
  DataFeedStoreV2,
  UpgradeableProxy,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../helpers/common';
import { DataFeedStoreV2Wrapper } from '../basic/V2';
import { UpgradeableProxyBaseWrapper } from './Base';

export class UpgradeableProxyDataFeedStoreV2Wrapper extends UpgradeableProxyBaseWrapper<DataFeedStoreV2> {
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
