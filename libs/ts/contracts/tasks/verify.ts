import { task } from 'hardhat/config';

import {
  entriesOf,
  EthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils';

import { readEvmDeployment } from '@blocksense/config-types';
import { ZeroAddress } from 'ethers';

import { getApiKeys, getCustomChainConfig } from './utils';

type VerifyTaskArgs = {
  address: EthereumAddress;
  constructorArgs: readonly any[];
};

task('etherscan-verify', 'Verify contracts on Etherscan')
  .addOptionalParam('explorerIndex', 'Index of the block explorer to use', '0')
  .setAction(async ({ explorerIndex }, { run, network, config }) => {
    const explorerIdx = Number(explorerIndex);

    config.etherscan = {
      ...config.etherscan,
      customChains: getCustomChainConfig(explorerIdx),
      apiKey: getApiKeys(),
    };

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
      ...entriesOf(deploymentData.contracts.coreContracts),
      ...entriesOf(deploymentData.contracts.CLAggregatorAdapter),
    ];

    for (const [contractName, data] of contracts) {
      if (!data || data.address === ZeroAddress) continue;

      console.log('-> Verifying contract:', contractName, data.address);
      await verify(data);
    }
  });
