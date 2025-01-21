import { Oracle } from '../../../../typechain';
import { deployContract } from '../../../experiments/utils/helpers/common';
import { OracleUnderlier } from '../types';
import { OracleBaseWrapper } from './Base';

export class OracleWrapper extends OracleBaseWrapper<Oracle> {
  constructor(name: string, underliers: OracleUnderlier[]) {
    if (underliers.length !== 1) {
      throw new Error('OracleWrapper only supports one underlier');
    }
    super(name, underliers);
  }

  public async init(address: string) {
    this.contract = await deployContract<Oracle>('Oracle', address);
  }
}
