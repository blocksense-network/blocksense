import { getAddressExplorerUrl } from '@blocksense/base-utils/evm';
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
    displayMode: Options.choice('display-mode', [
      'table',
      'markdown-list',
    ]).pipe(Options.withDefault('table')),
  },
  ({ dir, displayMode, network }) =>
    Effect.gen(function* () {
      const feedConfig = yield* Effect.tryPromise(() =>
        readConfig('feeds_config_v2', dir),
      );

      const deploymentData = yield* Effect.tryPromise(() =>
        readEvmDeployment(network, true),
      );

      const feeds: Array<TableRow> = feedConfig.feeds.reduce((res, feed) => {
        const f = `${feed.id}`;
        if (f in deploymentData.contracts.CLAggregatorAdapter) {
          const cl = deploymentData.contracts.CLAggregatorAdapter[f];
          return [...res, { feed, cl }];
        } else {
          return res;
        }
      }, []);

      if (displayMode == 'table') {
        const rows = feeds.map(({ cl, feed }) => {
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
      } else if (displayMode == 'markdown-list') {
        const rows: string = feeds.map(({ cl, feed }) => {
          const addr = cl?.address ?? '';
          const addrLink = `[\`${addr}\`](${getAddressExplorerUrl(network, addr)})`;
          const docsLink = `https://docs.blocksense.network/docs/data-feeds/feed/${feed.id}#${network}`;
          return (
            `* **${feed.full_name}** - ${addrLink}` + '\n' + `  * ${docsLink}`
          );
        });

        console.log(`Deployed feeds on ${network}`);
        for (const row of rows) console.log(row);
      }
    }),
);
