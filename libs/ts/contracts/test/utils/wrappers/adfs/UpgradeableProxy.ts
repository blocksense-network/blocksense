import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  IUpgradeableProxy__factory,
  UpgradeableProxyADFS,
} from '../../../../typechain';
import { ADFSWrapper } from './ADFS';
import { Feed, UpgradeableProxyCallMethods } from '../types';
import { deployContract } from '../../../experiments/utils/helpers/common';
import { IUpgradeableProxyADFSWrapper } from '../interfaces/IUpgradeableProxyADFSWarpper';

export class UpgradeableProxyADFSWrapper
  implements IUpgradeableProxyADFSWrapper
{
  public contract!: UpgradeableProxyADFS;
  public implementation!: ADFSWrapper;

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

  public async upgradeImplementation(
    newImplementation: ADFSWrapper,
    admin: HardhatEthersSigner,
    opts: {
      txData?: any;
    } = {},
  ) {
    this.implementation = newImplementation;

    return admin.sendTransaction({
      to: this.contract.target,
      data: IUpgradeableProxy__factory.createInterface()
        .getFunction('upgradeTo')
        .selector.concat(newImplementation.contract.target.toString().slice(2)),
      ...opts.txData,
    });
  }

  public async setAdmin(admin: HardhatEthersSigner, newAdmin: string) {
    return admin.sendTransaction({
      to: this.contract.target,
      data: IUpgradeableProxy__factory.createInterface()
        .getFunction('setAdmin')
        .selector.concat(newAdmin.slice(2)),
    });
  }

  public async proxyCall<T extends keyof UpgradeableProxyCallMethods>(
    method: T,
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    ...args: any[]
  ): Promise<ReturnType<UpgradeableProxyCallMethods[T]>> {
    return this.implementation[method](sequencer, feeds, {
      txData: {
        to: this.contract.target,
      },
      ...args,
    }) as ReturnType<UpgradeableProxyCallMethods[T]>;
  }
}
