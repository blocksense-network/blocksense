import { BaseContract } from 'ethers';
import { OracleUnderlier } from '../types';

export abstract class OracleBaseWrapper<T extends BaseContract> {
  public name: string;
  public contract!: T;
  public underliers!: OracleUnderlier[];

  constructor(name: string, underliers: OracleUnderlier[]) {
    this.name = name;
    this.underliers = underliers;
  }

  public async call(functionName: string, ...args: any[]) {
    return (await this.contract.getFunction(functionName)(...args)).wait();
  }

  public getName() {
    return this.name;
  }

  public abstract init(address: string): Promise<void>;
}
