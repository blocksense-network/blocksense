import { IChainlinkAggregator, Oracle } from '../../../../typechain';
import { deployContract } from '../../helpers/common';
import { OracleBaseWrapper } from './Base';

export class OracleWrapper extends OracleBaseWrapper<Oracle> {
  constructor(name: string, underliers: IChainlinkAggregator[]) {
    if (underliers.length !== 1) {
      throw new Error('OracleWrapper only supports one underlier');
    }
    super(name, underliers);
  }

  public async init(address: string) {
    this.contract = await deployContract<Oracle>('Oracle', address);
  }
}
