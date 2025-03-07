import { ADFSBaseWrapper } from './ADFSBase';
import { deployContract } from '../../../experiments/utils/helpers/common';
import { AggregatedDataFeedStoreReadAC } from '../../../../typechain';
import { AccessControlWrapper } from './AccessControl';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

export class ADFSReadACWrapper extends ADFSBaseWrapper {
  public readAccessControl!: AccessControlWrapper;

  public override async init(
    accessControlData: HardhatEthersSigner | string,
    readAccessControlData: HardhatEthersSigner | string,
  ) {
    this.accessControl = new AccessControlWrapper();
    await this.accessControl.init(accessControlData);

    this.readAccessControl = new AccessControlWrapper();
    await this.readAccessControl.init(readAccessControlData);

    this.contract = await deployContract<AggregatedDataFeedStoreReadAC>(
      'AggregatedDataFeedStoreReadAC',
      this.accessControl.contract.target,
      this.readAccessControl.contract.target,
    );
  }

  public override getName(): string {
    return 'AggregatedDataFeedStoreReadAC';
  }
}
