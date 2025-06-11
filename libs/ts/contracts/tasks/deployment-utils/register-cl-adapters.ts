import { Contract, ZeroAddress } from 'ethers';
import { Artifacts, RunTaskFunction } from 'hardhat/types';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';
import Safe from '@safe-global/protocol-kit';

import {
  CLAggregatorAdapterData,
  ContractsConfigV2,
} from '@blocksense/config-types/evm-contracts-deployment';

import { ContractNames, NetworkConfig } from '../types';

type Params = {
  deployData: ContractsConfigV2;
  config: NetworkConfig;
  safe: Safe;
  run: RunTaskFunction;
  artifacts: Artifacts;
};

export async function registerCLAdapters({
  deployData,
  config,
  safe,
  artifacts,
  run,
}: Params): Promise<void> {
  // The difference between setting n and n+1 feeds via CLFeedRegistryAdapter::setFeeds is slightly above 55k gas.
  console.log('\nRegistering CLAggregatorAdapters in CLFeedRegistryAdapter...');
  console.log('------------------------------------------------------------');

  const signer = config.adminMultisig.signer || config.ledgerAccount!;

  const registry = new Contract(
    deployData.coreContracts.CLFeedRegistryAdapter.address,
    artifacts.readArtifactSync(ContractNames.CLFeedRegistryAdapter).abi,
    signer,
  );

  // Split into batches of 100
  const BATCH_LENGTH = 100;
  const batches: Array<Array<CLAggregatorAdapterData>> = [];
  const aggregatorData = deployData.CLAggregatorAdapter.filter(d => d.base);
  const filteredData = [];

  for (const data of aggregatorData) {
    if (!data.base || !data.quote) {
      console.log(` -> Feed '${data.description}' has no base or quote`, '\n');
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
        ` -> Feed '${data.description}' already registered`,
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

    await run('multisig-tx-exec', {
      transactions: [safeTransactionData],
      safe,
      config,
    });
  }
}
