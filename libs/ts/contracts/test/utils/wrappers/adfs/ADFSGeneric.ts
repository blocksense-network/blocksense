import { deployContract } from '../../../experiments/utils/helpers/common';
import { AggregatedDataFeedStoreGeneric } from '@blocksense/contracts/typechain';
import { AccessControlWrapper } from './AccessControl';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ADFSBaseGenericWrapper } from './ADFSBaseGeneric';

export class ADFSGenericWrapper extends ADFSBaseGenericWrapper {
  public override async init(accessControlData: HardhatEthersSigner | string) {
    this.accessControl = new AccessControlWrapper();
    await this.accessControl.init(accessControlData);

    this.contract = await deployContract<AggregatedDataFeedStoreGeneric>(
      'AggregatedDataFeedStoreGeneric',
      this.accessControl.contract.target,
    );
  }

  public override getName(): string {
    return 'AggregatedDataFeedStoreGeneric';
  }
}
