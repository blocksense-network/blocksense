import { ethers } from 'hardhat';
import { ICLFeedRegistryAdapter, RegistryExp } from '../../../../../typechain';
import { OracleBaseWrapper } from '../Base';
import { deployContract } from '../../../../experiments/utils/helpers/common';
import { RegistryUnderlier } from '../../types';

export class RegistryWrapper extends OracleBaseWrapper<RegistryExp> {
  public registry!: ICLFeedRegistryAdapter;

  constructor(name: string, underliers: RegistryUnderlier[]) {
    super(name, underliers);
  }

  public async init(registryAddress: string) {
    this.registry = await ethers.getContractAt(
      'ICLFeedRegistryAdapter',
      registryAddress,
    );

    this.contract = await deployContract<RegistryExp>(
      'RegistryExp',
      this.registry.target,
    );
  }
}
