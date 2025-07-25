import { task } from 'hardhat/config';

import {
  entriesOf,
  EthereumAddress,
  parseNetworkName,
  sleep,
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

      const verify = async ({ address, constructorArgs }: VerifyTaskArgs) => {
        const maxRetries = 5;
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            await run('verify:verify', {
              address,
              constructorArguments: constructorArgs,
            });
            return;
          } catch (e: any) {
            const msg = e.message.toLowerCase();

            if (msg.includes('already verified')) {
              console.log('Already verified!');
              return;
            }

            attempt++;
            if (attempt < maxRetries) {
              console.warn(
                `Verification failed for ${address}, retrying... (attempt ${attempt}/${maxRetries})`,
              );
              await sleep(2000);
            } else {
              console.error(
                `Verification failed for ${address} after ${maxRetries} attempts.`,
              );
              throw new Error(e);
            }
          }
        }
      };

      const coreContracts = entriesOf(deploymentData.contracts.coreContracts);

      const adapterEntries = entriesOf(
        deploymentData.contracts.CLAggregatorAdapter,
      )
        .filter(([name]) => !isNaN(Number(name)))
        .sort((a, b) => Number(a[0]) - Number(b[0]));

      const index = binarySearch(
        adapterEntries,
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
