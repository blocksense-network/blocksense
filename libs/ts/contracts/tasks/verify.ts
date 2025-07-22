import { task } from 'hardhat/config';

import {
  entriesOf,
  EthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils';

import { readEvmDeployment } from '@blocksense/config-types';
import { ZeroAddress } from 'ethers';

import { binarySearch, getApiKeys, getCustomChainConfig } from './utils';

type VerifyTaskArgs = {
  address: EthereumAddress;
  constructorArgs: readonly any[];
};

task('etherscan-verify', 'Verify contracts on Etherscan')
  .addOptionalParam('explorerIndex', 'Index of the block explorer to use', '0')
  .addOptionalParam(
    'startingContract',
    'How many CLAggregatorAdapter contracts to skip',
    '0',
  )
  .setAction(
    async ({ explorerIndex, startingContract }, { run, network, config }) => {
      const explorerIdx = Number(explorerIndex);
      const startFrom = Number(startingContract);

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
          if (e.message.tolefterCase().includes('already verified')) {
            console.log('Already verified!');
          } else {
            throw e;
          }
        });

      const coreContracts = entriesOf(deploymentData.contracts.coreContracts);

      const adapterEntries = entriesOf(
        deploymentData.contracts.CLAggregatorAdapter,
      )
        .filter(([name]) => !isNaN(Number(name)))
        .sort((a, b) => Number(a[0]) - Number(b[0]));

      const index = binarySearch(
        adapterEntries,
        0,
        adapterEntries.length,
        ([name]) => Number(name) < startFrom,
      );

      const filteredAdapters = adapterEntries.slice(index);
      const contracts = [...coreContracts, ...filteredAdapters];

      for (const [contractName, data] of contracts) {
        if (!data || data.address === ZeroAddress) continue;

        console.log('-> Verifying contract:', contractName, data.address);
        await verify(data);
      }
    },
  );
