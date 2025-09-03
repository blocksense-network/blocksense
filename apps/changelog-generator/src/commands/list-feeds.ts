import { getAddressExplorerUrl } from '@blocksense/base-utils/evm';
import { renderTui, drawTable } from '@blocksense/base-utils/tty';
import {
  configDir,
  readConfig,
  listEvmNetworks,
  readEvmDeployment,
} from '@blocksense/config-types';
import { Command, Options } from '@effect/cli';
import { Effect } from 'effect';

const availableNetworks = await listEvmNetworks();

export const listFeeds = Command.make(
  'list-feeds',
  {
    dir: Options.directory('dir').pipe(Options.withDefault(configDir)),
    network: Options.choice('network', availableNetworks),
    displayMode: Options.choice('display-mode', [
      'table',
      'markdown-list',
    ]).pipe(Options.withDefault('table')),
    includeFeedRegistryInfo: Options.boolean('include-feed-registry-info').pipe(
      Options.withDefault(false),
    ),
  },
  ({ dir, displayMode, includeFeedRegistryInfo, network }) =>
    Effect.gen(function* () {
      const feedConfig = yield* Effect.tryPromise(() =>
        readConfig('feeds_config_v2', dir),
      );

      const deploymentData = yield* Effect.tryPromise(() =>
        readEvmDeployment(network, true),
      );

      const feeds = feedConfig.feeds.reduce(
        (
          res: Array<{ feed: (typeof feedConfig.feeds)[number]; cl: any }>,
          feed,
        ) => {
          const f = `${feed.id}`;
          if (f in deploymentData.contracts.CLAggregatorAdapter) {
            const cl = deploymentData.contracts.CLAggregatorAdapter[f];
            return [...res, { feed, cl }];
          } else {
            return res;
          }
        },
        [],
      );

      if (displayMode == 'table') {
        const baseHeaders = [
          'Feed Id',
          'Feed Name',
          'CLAdapter Address',
          'Decimals',
          'Category',
          'Threshold',
          'Heartbeat (ms)',
          'Oracle Script',
        ];
        const extendedHeaders = includeFeedRegistryInfo
          ? [
              ...baseHeaders,
              'CLRegistryAdapter Base Address',
              'CLRegistryAdapter Quote Address',
            ]
          : baseHeaders;

        const rows = feeds.map(({ cl, feed }) => {
          const baseRow = [
            `${feed.id}`,
            feed.full_name,
            cl?.address ?? '',
            `${feed.additional_feed_info.decimals}`,
            `${feed.additional_feed_info.category}`,
            `${feed.schedule.deviation_percentage}`,
            `${feed.schedule.heartbeat_ms}`,
            `${feed.oracle_id}`,
          ];
          return includeFeedRegistryInfo
            ? [...baseRow, cl?.base ?? '-', cl?.quote ?? '-']
            : baseRow;
        });

        renderTui(
          drawTable([...rows], {
            headers: extendedHeaders,
          }),
        );
      } else if (displayMode == 'markdown-list') {
        const rows = feeds.map(({ cl, feed }) => {
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
