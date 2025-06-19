import { deployContract } from '../../../experiments/utils/helpers/common';
import { UpgradeableProxyADFS } from '@blocksense/contracts/typechain';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ADFSGenericWrapper } from './ADFSGeneric';
import { UpgradeableProxyADFSBaseWrapper } from './UpgradeableProxyBase';

export class UpgradeableProxyADFSGenericWrapper extends UpgradeableProxyADFSBaseWrapper {
  public async init(
    admin: HardhatEthersSigner,
    accessControlData: HardhatEthersSigner | string,
    implementationCallData: string = '0x',
  ) {
    this.implementation = new ADFSGenericWrapper();
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
    return 'UpgradeableProxyADFSGeneric';
  }
}
