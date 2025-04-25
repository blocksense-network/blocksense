import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { UpgradeableProxyADFS } from '../../../../typechain';
import { ADFSWrapper } from './ADFS';
import { Feed, ProxyOp, UpgradeableProxyCallMethods } from '../types';
import { IUpgradeableProxyADFSWrapper } from '../interfaces/IUpgradeableProxyADFSWarpper';
import { ADFSGenericWrapper } from './ADFSGeneric';

export abstract class UpgradeableProxyADFSBaseWrapper
  implements IUpgradeableProxyADFSWrapper
{
  public contract!: UpgradeableProxyADFS;
  public implementation!: ADFSWrapper | ADFSGenericWrapper;

  public async upgradeImplementationAndCall(
    newImplementation: ADFSWrapper,
    admin: HardhatEthersSigner,
    calldata: string,
    opts: {
      txData?: any;
    } = {},
  ) {
    this.implementation = newImplementation;

    return admin.sendTransaction({
      to: this.contract.target,
      data: ProxyOp.UpgradeTo.concat(
        newImplementation.contract.target.toString().slice(2),
      ).concat(calldata.slice(2)),
      ...opts.txData,
    });
  }

  public async setAdmin(admin: HardhatEthersSigner, newAdmin: string) {
    return admin.sendTransaction({
      to: this.contract.target,
      data: ProxyOp.SetAdmin.concat(newAdmin.slice(2)),
    });
  }

  public async proxyCall<T extends keyof UpgradeableProxyCallMethods>(
    method: T,
    caller: HardhatEthersSigner,
    feeds: Feed[],
    ...args: any[]
  ): Promise<ReturnType<UpgradeableProxyCallMethods[T]>> {
    return this.implementation[method](
      caller,
      feeds,
      Object.assign(
        {
          txData: {
            to: this.contract.target,
          },
        },
        ...args,
      ),
    ) as ReturnType<UpgradeableProxyCallMethods[T]>;
  }

  public abstract init(
    adminAddress: string,
    accessControlData: HardhatEthersSigner | string,
    implementationCallData?: string,
  ): Promise<void>;

  public abstract getName(): string;
}
