import { ethers } from 'hardhat';
import { FeedRegistryV2, IChainlinkAggregator } from '../../../../../typechain';
import { Registry } from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { RegistryWrapper } from './Base';

export class RegistryWrapperV2 extends RegistryWrapper {
  constructor(name: string, underliers: IChainlinkAggregator[]) {
    super(name, underliers);
  }

  public async init(address: string, registryAddress?: string) {
    if (!registryAddress) {
      this.registry = await deployContract<FeedRegistryV2>(
        'FeedRegistryV2',
        address,
      );
    } else {
      this.registry = await ethers.getContractAt(
        'FeedRegistryV2',
        registryAddress,
      );
    }

    this.contract = await deployContract<Registry>(
      'Registry',
      this.registry.target,
    );
  }
}
