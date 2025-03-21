import { deployContract } from '../../../experiments/utils/helpers/common';
import { UpgradeableProxyADFS } from '../../../../typechain';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { UpgradeableProxyADFSBaseWrapper } from './UpgradeableProxyBase';
import { ADFSWrapper } from './ADFS';

export class UpgradeableProxyADFSWrapper extends UpgradeableProxyADFSBaseWrapper {
  public async init(
    adminAddress: string,
    accessControlData: HardhatEthersSigner | string,
  ) {
    this.implementation = new ADFSWrapper();
    await this.implementation.init(accessControlData);

    this.contract = await deployContract<UpgradeableProxyADFS>(
      'UpgradeableProxyADFS',
      this.implementation.contract.target,
      adminAddress,
    );
  }

  public getName(): string {
    return 'UpgradeableProxyADFS';
  }
}
