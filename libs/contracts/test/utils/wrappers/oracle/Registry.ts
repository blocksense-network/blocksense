import { ethers } from 'hardhat';
import { IChainlinkAggregator } from '../../../../typechain';
import { Registry } from '../../../../typechain';
import { FeedRegistry } from '../../../../typechain/contracts/chainlink-proxies/FeedRegistry';
import { deployContract } from '../../helpers/common';
import { OracleBaseWrapper } from './Base';

export class RegistryWrapper extends OracleBaseWrapper<Registry> {
  public registry!: FeedRegistry;

  constructor(name: string, underliers: IChainlinkAggregator[]) {
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
