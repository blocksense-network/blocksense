import { ethers } from 'hardhat';
import { FeedRegistryV1, FeedRegistryV2 } from '../../../../../typechain';
import { Registry } from '../../../../../typechain';
import { OracleBaseWrapper } from '../Base';
import { deployContract } from '../../../helpers/common';

export class RegistryWrapper extends OracleBaseWrapper<Registry> {
  public registry!: FeedRegistryV1 | FeedRegistryV2;

  public async init(_: string, registryAddress?: string) {
    if (registryAddress) {
      this.registry = await ethers.getContractAt(
        'FeedRegistry',
        registryAddress,
      );
    }

    this.contract = await deployContract<Registry>(
      'Registry',
      this.registry.target,
    );
  }
}
