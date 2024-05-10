import { IChainlinkAggregator, Oracle } from '../../../typechain';
import { deployContract } from '../helpers/common';

export class OracleWrapper {
  public name: string;
  public contract!: Oracle;
  public underlier!: IChainlinkAggregator;

  constructor(name: string, underlier: IChainlinkAggregator) {
    this.name = name;
    this.underlier = underlier;
  }

  public async init(address: string) {
    this.contract = await deployContract<Oracle>('Oracle', address);
  }

  public async call(functionName: string, ...args: any[]) {
    return (await this.contract.getFunction(functionName)(...args)).wait();
  }

  public getName() {
    return this.name;
  }
}
