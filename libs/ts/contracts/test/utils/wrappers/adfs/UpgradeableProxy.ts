import { deployContract } from '../../../experiments/utils/helpers/common';
import { UpgradeableProxyADFS } from '../../../../typechain';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { UpgradeableProxyADFSBaseWrapper } from './UpgradeableProxyBase';
import { ADFSWrapper } from './ADFS';

export class UpgradeableProxyADFSWrapper extends UpgradeableProxyADFSBaseWrapper {
  public async init(
    adminAddress: string,
    accessControlData: HardhatEthersSigner | string,
    implementationCallData: string = '0x',
  ) {
    this.implementation = new ADFSWrapper();
    await this.implementation.init(accessControlData);

    this.contract = await deployContract<UpgradeableProxyADFS>(
      'UpgradeableProxyADFS',
      adminAddress,
      this.implementation.contract.target,
      implementationCallData,
    );
  }

  public getName(): string {
    return 'UpgradeableProxyADFS';
  }
}
