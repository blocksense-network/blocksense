import { ethers } from 'hardhat';
import {
  CLAggregatorAdapter,
  CLFeedRegistryAdapter,
  IChainlinkAggregator,
} from '../../../../../typechain';
import { Registry } from '../../../../../typechain';
import { OracleBaseWrapper } from '../Base';
import { deployContract } from '../../../helpers/common';

export class RegistryWrapper extends OracleBaseWrapper<Registry> {
  public registry!: CLFeedRegistryAdapter;

  constructor(
    name: string,
    underliers: (CLAggregatorAdapter | IChainlinkAggregator)[],
  ) {
    super(name, underliers);
  }

  public async init(address: string, registryAddress?: string) {
    if (!registryAddress) {
      this.registry = await deployContract<CLFeedRegistryAdapter>(
        'CLFeedRegistryAdapter',
        address,
      );
    } else {
      this.registry = await ethers.getContractAt(
        'CLFeedRegistryAdapter',
        registryAddress,
      );
    }

    this.contract = await deployContract<Registry>(
      'Registry',
      this.registry.target,
    );
  }
}
