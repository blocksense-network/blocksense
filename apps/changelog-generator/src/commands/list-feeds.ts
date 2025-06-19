import { readdirSync } from 'fs';

import { configDir, parseNetworkName } from '@blocksense/base-utils';
import type { TableRow } from '@blocksense/base-utils/tty';
import { renderTui, drawTable } from '@blocksense/base-utils/tty';
import {
  configDirs,
  readConfig,
  readEvmDeployment,
} from '@blocksense/config-types';
import { Command, Options } from '@effect/cli';
import { Effect } from 'effect';

const availableNetworks = readdirSync(
  configDirs.evm_contracts_deployment_v2,
).map(filename => parseNetworkName(filename.replace(/\.json$/, '')));

export const listFeeds = Command.make(
  'list-feeds',
  {
    dir: Options.directory('dir').pipe(Options.withDefault(configDir)),
    network: Options.choice('network', availableNetworks),
  },
  ({ dir, network }) =>
    Effect.gen(function* () {
      const feedConfig = yield* Effect.tryPromise(() =>
        readConfig('feeds_config_v2', dir),
      );

      const deploymentData = yield* Effect.tryPromise(() =>
        readEvmDeployment(network, true),
      );

      const rows: Array<TableRow> = feedConfig.feeds.map(feed => {
        const contract = deploymentData?.contracts?.CLAggregatorAdapter.find(
          data => data.constructorArgs[2] == feed.id,
        );
        return [
          feed.full_name,
          `${contract?.address ?? ''}`,
          `${contract?.constructorArgs[1] ?? ''}`,
          `${contract?.base ?? ''}`,
          `${contract?.quote ?? ''}`,
        ];
      });

      renderTui(
        drawTable([...rows], {
          headers: [
            'Feed Name',
            'Address',
            'Decimals',
            'Base Address',
            'Quote Address',
          ],
        }),
      );
    }),
);
