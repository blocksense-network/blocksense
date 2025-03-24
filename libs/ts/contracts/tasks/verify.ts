import { task } from 'hardhat/config';

import {
  configDir,
  entries,
  EthereumAddress,
  parseNetworkName,
  selectDirectory,
} from '@blocksense/base-utils';

import { DeploymentConfigSchemaV2 } from '@blocksense/config-types/evm-contracts-deployment';
import { ethers } from 'ethers';

type VerifyTaskArgs = {
  address: EthereumAddress;
  constructorArgs: readonly any[];
};

task('etherscan-verify', 'Verify contracts on Etherscan').setAction(
  async (_, { run, network }) => {
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

    const fileName = `evm_contracts_deployment_v2/${network.name}`;
    const { decodeJSON } = selectDirectory(configDir);
    const deployment = await decodeJSON(
      { name: fileName },
      DeploymentConfigSchemaV2,
    );
    const deploymentData = deployment[parseNetworkName(network.name)];
    if (!deploymentData) {
      console.error(`Deployment data not found for network: '${network.name}'`);
      process.exit(1);
    }

    for (const [contractName, data] of entries(
      deploymentData.contracts.coreContracts,
    )) {
      if (data && data.address !== ethers.ZeroAddress) {
        console.log('-> Verifying contract:', contractName, data.address);
        await verify(data);
      }
    }

    for (const data of deploymentData.contracts.CLAggregatorAdapter) {
      console.log('-> Verifying contract:', data.description, data.address);
      await verify(data);
    }
  },
);
