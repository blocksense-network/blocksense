import { deployContract } from '../../../experiments/utils/helpers/common';
import { UpgradeableProxyADFS } from '../../../../typechain';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { UpgradeableProxyADFSBaseWrapper } from './UpgradeableProxyBase';
import { ADFSReadACWrapper } from './ADFSReadAC';

export class UpgradeableProxyADFSReadACWrapper extends UpgradeableProxyADFSBaseWrapper {
  public async init(
    adminAddress: string,
    accessControlData: HardhatEthersSigner | string,
    readAccessControlData: HardhatEthersSigner | string,
  ) {
    this.implementation = new ADFSReadACWrapper();
    await this.implementation.init(accessControlData, readAccessControlData);

    this.contract = await deployContract<UpgradeableProxyADFS>(
      'UpgradeableProxyADFS',
      this.implementation.contract.target,
      adminAddress,
    );
  }

  public getName(): string {
    return 'UpgradeableProxyADFSReadAC';
  }
}
