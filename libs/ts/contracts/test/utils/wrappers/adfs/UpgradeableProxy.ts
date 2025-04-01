import { deployContract } from '../../../experiments/utils/helpers/common';
import { UpgradeableProxyADFS } from '../../../../typechain';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { UpgradeableProxyADFSBaseWrapper } from './UpgradeableProxyBase';
import { ADFSWrapper } from './ADFS';

export class UpgradeableProxyADFSWrapper extends UpgradeableProxyADFSBaseWrapper {
  public async init(
    admin: HardhatEthersSigner,
    accessControlData: HardhatEthersSigner | string,
    implementationCallData: string = '0x',
  ) {
    this.implementation = new ADFSWrapper();
    await this.implementation.init(accessControlData);

    this.contract = await deployContract<UpgradeableProxyADFS>(
      'UpgradeableProxyADFS',
      admin.address,
    );

    this.upgradeImplementationAndCall(
      this.implementation,
      admin,
      implementationCallData,
    );
  }

  public getName(): string {
    return 'UpgradeableProxyADFS';
  }
}
