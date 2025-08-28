import type { TableRow } from '@blocksense/base-utils/tty';
import { renderTui, drawTable } from '@blocksense/base-utils/tty';
import {
  configDir,
  readConfig,
  listEvmNetworks,
  readEvmDeployment,
} from '@blocksense/config-types';
import { Command, Options } from '@effect/cli';
import { Effect } from 'effect';

const availableNetworks = await listEvmNetworks(['somnia-mainnet']);

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

      const rows: Array<TableRow> = feedConfig.feeds
        .filter(
          feed => `${feed.id}` in deploymentData.contracts.CLAggregatorAdapter,
        )
        .map(feed => {
          const cl = deploymentData.contracts.CLAggregatorAdapter[`${feed.id}`];
          return [
            feed.full_name,
            cl?.address ?? '',
            `${cl?.constructorArgs[1] ?? ''}`,
            cl?.base ?? '',
            cl?.quote ?? '',
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
