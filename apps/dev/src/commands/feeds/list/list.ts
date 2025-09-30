import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';

import { getAddressExplorerUrl } from '@blocksense/base-utils/evm';
import { drawTable, renderTui } from '@blocksense/base-utils/tty';
import {
  configDir,
  listEvmNetworks,
  readConfig,
  readEvmDeployment,
} from '@blocksense/config-types';

export const list = Command.make(
  'list',
  {
    dir: Options.directory('dir').pipe(Options.withDefault(configDir)),
    network: Options.choice('network', await listEvmNetworks()),
    displayMode: Options.choice('display-mode', [
      'table',
      'markdown-list',
    ]).pipe(Options.withDefault('table')),
    includeFeedRegistryInfo: Options.boolean('include-feed-registry-info').pipe(
      Options.withDefault(false),
    ),
    category: Options.optional(Options.text('category')),
    oracleId: Options.optional(Options.text('oracle-id')),
    feedId: Options.optional(Options.text('feed-id')),
    feedName: Options.optional(Options.text('feed-name')),
  },
  ({
    category,
    dir,
    displayMode,
    feedId,
    feedName,
    includeFeedRegistryInfo,
    network,
    oracleId,
  }) =>
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

      let filteredFeeds = feeds;

      filteredFeeds = filterBy(
        filteredFeeds,
        category,
        ({ feed }) => feed.additional_feed_info.category,
      );
      filteredFeeds = filterBy(
        filteredFeeds,
        oracleId,
        ({ feed }) => `${feed.oracle_id}`,
      );
      filteredFeeds = filterBy(
        filteredFeeds,
        feedId,
        ({ feed }) => `${feed.id}`,
      );
      filteredFeeds = filterBy(
        filteredFeeds,
        feedName,
        ({ feed }) => feed.full_name,
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

        const rows = filteredFeeds.map(({ cl, feed }) => {
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
        const rows = filteredFeeds.map(({ cl, feed }) => {
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

function matchesRegex(value: unknown, pattern: string, flags = 'i') {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    throw new Error(`Invalid regex: ${pattern}\n${String(e)}`);
  }
  return regex.test(String(value ?? ''));
}

const filterBy = <T>(
  arr: T[],
  opt: Option.Option<string>,
  getValue: (item: T) => unknown,
): T[] => {
  if (Option.isSome(opt)) {
    return arr.filter(item => matchesRegex(getValue(item), opt.value));
  }
  return arr;
};
