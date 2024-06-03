import { ethers } from 'hardhat';
import {
  ChainlinkProxy,
  FeedRegistry,
  IChainlinkAggregator,
} from '../../../../../typechain';
import { Registry } from '../../../../../typechain';
import { OracleBaseWrapper } from '../Base';
import { deployContract } from '../../../helpers/common';

export class RegistryWrapper extends OracleBaseWrapper<Registry> {
  public registry!: FeedRegistry;

  constructor(
    name: string,
    underliers: (ChainlinkProxy | IChainlinkAggregator)[],
  ) {
    super(name, underliers);
  }

  public async init(address: string, registryAddress?: string) {
    if (!registryAddress) {
      this.registry = await deployContract<FeedRegistry>(
        'FeedRegistry',
        address,
      );
    } else {
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
