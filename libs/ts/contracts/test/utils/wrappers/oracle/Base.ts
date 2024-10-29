import { BaseContract } from 'ethers';
import {
  CLAggregatorAdapter,
  IChainlinkAggregator,
} from '../../../../typechain';

export abstract class OracleBaseWrapper<T extends BaseContract> {
  public name: string;
  public contract!: T;
  public underliers!: (CLAggregatorAdapter | IChainlinkAggregator)[];

  constructor(
    name: string,
    underliers: (CLAggregatorAdapter | IChainlinkAggregator)[],
  ) {
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
