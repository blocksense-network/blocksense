import { Effect } from 'effect';
import { Command, Options } from '@effect/cli';
import { ethers } from 'ethers';
import {
  listEvmNetworks,
  readEvmDeployment,
} from '@blocksense/config-types/read-write-config';
import { getRpcUrl } from '@blocksense/base-utils/evm';
import { decodeADFSCalldata } from '@blocksense/contracts/calldata-decoder';

export const watcher = Command.make(
  'watcher',
  {
    network: Options.choice('network', await listEvmNetworks()),
    hasBlockNumber: Options.boolean('has-block-number').pipe(
      Options.withDefault(true),
    ),
  },
  ({ hasBlockNumber, network }) =>
    Effect.gen(function* () {
      const rpcUrl = getRpcUrl(network);
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        polling: true,
      });

      console.log(`Watching ADFS calldata on ${network} for rpc: ${rpcUrl}`);

      const deploymentData = yield* Effect.tryPromise(() =>
        readEvmDeployment(network, true),
      );

      const filter = {
        address:
          deploymentData.contracts.coreContracts.UpgradeableProxyADFS.address,
        topics: [
          '0xe64378c8d8a289137204264780c7669f3860a703795c6f0574d925d473a4a2a7',
        ],
      };

      provider.on(filter, async event => {
        const tx = await provider.getTransaction(event.transactionHash);

        const { errors } = decodeADFSCalldata({
          calldata: tx!.data,
          hasBlockNumber,
        });

        if (errors.length) {
          console.log('\ntx hash: ', tx!.hash);
          console.error('Error parsing calldata:', errors);
        } else {
          console.log(`\nCalldata for block ${event.blockNumber} is valid!`);
        }
      });
    }),
);
