import { parse as parsePath } from 'path';

import { task } from 'hardhat/config';

import {
  configFiles,
  entries,
  EthereumAddress,
  parseNetworkName,
  selectDirectory,
} from '@blocksense/base-utils';

import { DeploymentConfigSchema } from '@blocksense/config-types/evm-contracts-deployment';

type VerifyTaskArgs = {
  address: EthereumAddress;
  constructorArgs: readonly any[];
};

const defaultDeployment = configFiles['evm_contracts_deployment_v1'];

task('etherscan-verify', 'Verify contracts on Etherscan')
  .addParam('deploymentFile', 'Path to deployment file', defaultDeployment)
  .setAction(async (args, { run, network }) => {
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

    const { dir, name } = parsePath(args.deploymentFile);
    const { decodeJSON } = selectDirectory(dir);
    const deployment = await decodeJSON({ name }, DeploymentConfigSchema);
    const deploymentData = deployment[parseNetworkName(network.name)];
    if (!deploymentData) {
      console.error(`Deployment data not found for network: '${network.name}'`);
      process.exit(1);
    }

    for (const [contractName, data] of entries(
      deploymentData.contracts.coreContracts,
    )) {
      console.log('-> Verifying contract:', contractName, data.address);
      await verify(data);
    }

    for (const data of deploymentData.contracts.CLAggregatorAdapter) {
      console.log('-> Verifying contract:', data.description, data.address);
      await verify(data);
    }
  });
