import { expect } from 'chai';
import { BaseContract, ethers } from 'ethers';
import { network } from 'hardhat';
import { IBaseWrapper } from '../interfaces/IBaseWrapper';
import {
  ITransparentUpgradeableProxy__factory,
  UpgradeableProxy,
} from '../../../../typechain';
import { IWrapper } from '../interfaces/IWrapper';

export abstract class UpgradeableProxyBaseWrapper<
  U extends BaseContract,
  T extends IWrapper<U>,
> implements IBaseWrapper<UpgradeableProxy>
{
  public contract!: UpgradeableProxy;
  public implementation!: T;

  public async setFeeds(
    keys: number[],
    values: string[],
    ...args: any[]
  ): Promise<any> {
    return this.implementation.setFeeds(
      keys,
      values,
      {
        to: this.contract.target,
      },
      ...args,
    );
  }

  public async upgradeImplementation(
    newImplementation: T,
    ...args: any[]
  ): Promise<any> {
    const params: any = {};
    params.to = this.contract.target;
    params.data = ethers.solidityPacked(
      ['bytes4', 'address'],
      [
        ITransparentUpgradeableProxy__factory.createInterface().getFunction(
          'upgradeToAndCall',
        ).selector,
        newImplementation.contract.target,
      ],
    );

    this.implementation = newImplementation;

    for (const arg of args) {
      Object.assign(params, arg);
    }

    const txHash = await network.provider.send('eth_sendTransaction', [params]);

    return network.provider.send('eth_getTransactionReceipt', [txHash]);
  }

  public async checkSetValues(keys: number[], values: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const value = await this.getValue(
        this.implementation.getLatestValueData(keys[i]),
      );
      expect(value).to.be.eq(values[i]);
    }
  }

  public async getValue(data: string, ...args: any[]): Promise<string> {
    const params: any = {};
    params.to = this.contract.target;
    params.data = data;

    for (const arg of args) {
      Object.assign(params, arg);
    }

    return network.provider.send('eth_call', [params, 'latest']);
  }

  public abstract init(): Promise<void>;

  public abstract getName(): string;
}
