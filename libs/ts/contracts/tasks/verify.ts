import { task } from 'hardhat/config';

import {
  entries,
  EthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils';

import { readEvmDeployment } from '@blocksense/config-types';
import { ethers } from 'ethers';

type VerifyTaskArgs = {
  address: EthereumAddress;
  constructorArgs: readonly any[];
};

task('etherscan-verify', 'Verify contracts on Etherscan').setAction(
  async (_, { run, network }) => {
    const deploymentData = await readEvmDeployment(
      parseNetworkName(network.name),
      true,
    );

    const verify = ({ address, constructorArgs }: VerifyTaskArgs) =>
      run('verify:verify', {
        address,
        constructorArguments: constructorArgs,
      }).catch(e => {
        if (e.message.toLowerCase().includes('already verified')) {
          console.log('Already verified!');
        } else {
          throw e;
        }
      });

    const contracts = [
      ...entries(deploymentData.contracts.coreContracts),
      ...entries(deploymentData.contracts.CLAggregatorAdapter),
    ];

    for (const [contractName, data] of contracts) {
      if (!data || data.address !== ethers.ZeroAddress) continue;

      console.log('-> Verifying contract:', contractName, data.address);
      await verify(data);
    }
  },
);
