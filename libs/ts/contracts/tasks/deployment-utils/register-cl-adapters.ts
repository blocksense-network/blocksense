import { Contract, ZeroAddress } from 'ethers';
import { Artifacts } from 'hardhat/types';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';
import Safe from '@safe-global/protocol-kit';
import { entriesOf } from '@blocksense/base-utils/array-iter';

import {
  CLAggregatorAdapterDataV2,
  ContractsConfigV2,
} from '@blocksense/config-types/evm-contracts-deployment';

import { ContractNames, NetworkConfig } from '../types';
import { executeMultisigTransaction } from './multisig-tx-exec';

type Params = {
  deployData: ContractsConfigV2;
  config: NetworkConfig;
  safe: Safe;
  artifacts: Artifacts;
};

export async function registerCLAdapters({
  deployData,
  config,
  safe,
  artifacts,
}: Params): Promise<void> {
  // The difference between setting n and n+1 feeds via CLFeedRegistryAdapter::setFeeds is slightly above 55k gas.
  console.log('\nRegistering CLAggregatorAdapters in CLFeedRegistryAdapter...');
  console.log('------------------------------------------------------------');

  const signer = config.deployer;

  const registry = new Contract(
    deployData.coreContracts.CLFeedRegistryAdapter.address,
    artifacts.readArtifactSync(ContractNames.CLFeedRegistryAdapter).abi,
    signer,
  );

  // Split into batches of 100
  const BATCH_LENGTH = 100;
  const batches: CLAggregatorAdapterDataV2[][] = [];
  const filteredData: CLAggregatorAdapterDataV2[] = [];

  for (const [description, data] of entriesOf(deployData.CLAggregatorAdapter)) {
    if (!data.base || !data.quote) {
      console.log(` -> Feed '${description}' has no base or quote`, '\n');
      continue;
    }

    const feed = await registry.connect(signer).getFunction('getFeed')(
      data.base,
      data.quote,
    );

    if (feed === ZeroAddress) {
      filteredData.push(data);
    } else {
      console.log(
        ` -> Feed '${description}' already registered`,
        {
          base: data.base,
          quote: data.quote,
          feed,
        },
        '\n',
      );
    }
  }
  for (let i = 0; i < filteredData.length; i += BATCH_LENGTH) {
    batches.push(filteredData.slice(i, i + BATCH_LENGTH));
  }

  // Set feeds in batches
  for (const batch of batches) {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: registry.target.toString(),
      value: '0',
      data: registry.interface.encodeFunctionData('setFeeds', [
        batch.map(({ base, quote, address }) => ({
          base,
          quote,
          feed: address,
        })),
      ]),
      operation: OperationType.Call,
    };

    console.log(
      `Registering ${batch.length} CLAggregatorAdapters in CLFeedRegistryAdapter`,
    );

    await executeMultisigTransaction({
      transactions: [safeTransactionData],
      safe,
      config,
    });
  }
}
