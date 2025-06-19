import { Console, Effect, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';

import {
  configDir,
  readConfig,
  readEvmDeployment,
} from '@blocksense/config-types';
import type { NetworkName } from '@blocksense/base-utils';
import { networkName } from '@blocksense/base-utils';
import type { TableRow } from '@blocksense/base-utils/tty';
import { drawTable, renderTui } from '@blocksense/base-utils/tty';

const listFeeds = Command.make(
  'list-feeds',
  {
    dir: Options.directory('dir').pipe(Options.withDefault(configDir)),
    network: Options.text('network'),
  },
  ({ dir, network }) =>
    Effect.gen(function* () {
      const parsedNetwork: NetworkName =
        yield* S.decodeUnknown(networkName)(network);
      const config = yield* Effect.tryPromise(() =>
        readConfig('feeds_config_v2', dir),
      );

      const deploymentData = yield* Effect.tryPromise(() =>
        readEvmDeployment(parsedNetwork, true),
      ).pipe(
        Effect.catchAll(_err =>
          Console.error(
            `Deployment data for v2 not found for network: '${parsedNetwork}'`,
          ).pipe(Effect.as(null)),
        ),
      );

      if (!deploymentData) {
        return;
      }

      const rows: Array<TableRow> = [];
      config.feeds.forEach(feed => {
        const contract =
          deploymentData?.contracts?.CLAggregatorAdapter[Number(feed.id)]; // TODO: (danielstoyanov) Once we merge the new evm deployment config files remove the cast
        rows.push([
          feed.full_name,
          `${contract?.address ?? ''}`,
          `${contract?.constructorArgs[1] ?? ''}`,
          `${contract?.base ?? ''}`,
          `${contract?.quote ?? ''}`,
        ]);
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

const command = Command.make('changelog-generator').pipe(
  Command.withSubcommands([listFeeds]),
);

export const run = Command.run(command, {
  name: 'Changelog Generator',
  version: '0.0.0',
});
