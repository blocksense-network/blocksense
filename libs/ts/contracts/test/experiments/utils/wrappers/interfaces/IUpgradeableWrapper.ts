import { BaseContract } from 'ethers';
import { ISetWrapper } from './ISetWrapper';
import { IWrapper } from './IWrapper';

export interface IUpgradeableWrapper<
  T extends BaseContract,
  U extends BaseContract,
> extends ISetWrapper<T> {
  implementation: IWrapper<U>;

  upgradeImplementation(
    newImplementation: IWrapper<U>,
    ...args: any[]
  ): Promise<any>;

  getValue(data: string, ...args: any[]): Promise<string>;
}
