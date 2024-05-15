import { ethers } from 'hardhat';
import { FeedRegistryV1, IChainlinkAggregator } from '../../../../../typechain';
import { Registry } from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { RegistryWrapper } from './Base';

export class RegistryWrapperV1 extends RegistryWrapper {
  constructor(name: string, underliers: IChainlinkAggregator[]) {
    super(name, underliers);
  }

  public async init(address: string, registryAddress?: string) {
    if (!registryAddress) {
      this.registry = await deployContract<FeedRegistryV1>(
        'FeedRegistryV1',
        address,
      );
    } else {
      this.registry = await ethers.getContractAt(
        'FeedRegistryV1',
        registryAddress,
      );
    }

    this.contract = await deployContract<Registry>(
      'Registry',
      this.registry.target,
    );
  }
}
