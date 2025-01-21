import { ethers } from 'hardhat';
import {
  CLAggregatorAdapterExp,
  CLFeedRegistryAdapterExp,
  IChainlinkAggregator,
  RegistryExp,
} from '../../../../../typechain';
import { OracleBaseWrapper } from '../Base';
import { deployContract } from '../../../../experiments/utils/helpers/common';

export class RegistryWrapper extends OracleBaseWrapper<RegistryExp> {
  public registry!: CLFeedRegistryAdapterExp;

  constructor(
    name: string,
    underliers: (CLAggregatorAdapterExp | IChainlinkAggregator)[],
  ) {
    super(name, underliers);
  }

  public async init(address: string, registryAddress?: string) {
    if (!registryAddress) {
      this.registry = await deployContract<CLFeedRegistryAdapterExp>(
        'CLFeedRegistryAdapterExp',
        address,
      );
    } else {
      this.registry = await ethers.getContractAt(
        'CLFeedRegistryAdapterExp',
        registryAddress,
      );
    }

    this.contract = await deployContract<RegistryExp>(
      'RegistryExp',
      this.registry.target,
    );
  }
}
