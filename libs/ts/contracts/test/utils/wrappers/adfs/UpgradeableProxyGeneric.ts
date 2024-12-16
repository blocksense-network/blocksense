import { deployContract } from '../../../experiments/utils/helpers/common';
import { UpgradeableProxyADFS } from '../../../../typechain';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ADFSGenericWrapper } from './ADFSGeneric';
import { UpgradeableProxyADFSBaseWrapper } from './UpgradeableProxyBase';

export class UpgradeableProxyADFSGenericWrapper extends UpgradeableProxyADFSBaseWrapper {
  public async init(
    adminAddress: string,
    accessControlData: HardhatEthersSigner | string,
  ) {
    this.implementation = new ADFSGenericWrapper();
    await this.implementation.init(accessControlData);

    this.contract = await deployContract<UpgradeableProxyADFS>(
      'UpgradeableProxyADFS',
      this.implementation.contract.target,
      adminAddress,
    );
  }

  public getName(): string {
    return 'UpgradeableProxyADFSGeneric';
  }
}
