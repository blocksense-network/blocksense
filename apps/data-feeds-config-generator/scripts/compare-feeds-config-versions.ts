import Table from 'cli-table3';
import {
  configDir,
  NetworkName,
  parseNetworkName,
  selectDirectory,
} from '@blocksense/base-utils';
import { Effect, Schema as S } from 'effect';
import { NodeRuntime } from '@effect/platform-node';
import { readConfig, readEvmDeployment } from '@blocksense/config-types';
import chalk from 'chalk';

const fields = ['description', 'address', 'decimals', 'base', 'quote'] as const;
type Field = (typeof fields)[number];
type CompareEntry = {
  [K in Field]: K extends 'decimals' ? number : string | null;
};

type DiffEntry = {
  address?: string;
  decimals?: number;
  base?: string;
  quote?: string;
};

type Diff = {
  feed: string;
  oldEntry: DiffEntry;
  newEntry: DiffEntry;
};

const ProviderSchema = S.Struct({
  allow_feeds: S.NullishOr(S.Array(S.Number)),
});
type Provider = typeof ProviderSchema.Type;

const SequencerDeploymentConfigSchema = S.Struct({
  providers: S.Record({
    key: S.String,
    value: S.mutable(ProviderSchema),
  }),
});
type SequencerDeploymentConfig = typeof SequencerDeploymentConfigSchema.Type;

const ModifiedSequencerDeploymentConfigSchema = S.transformOrFail(
  SequencerDeploymentConfigSchema,
  SequencerDeploymentConfigSchema,
  {
    decode: (inputSchema, _, ast) => {
      const transformedProviders: Record<string, Provider> = {};
      for (const [key, value] of Object.entries(inputSchema.providers)) {
        transformedProviders[key.replace(/[_]/g, '-')] = value;
      }
      return Effect.succeed({
        providers: transformedProviders,
      } as SequencerDeploymentConfig);
    },
    encode: (outputSchema, _, ast) => Effect.succeed({ providers: {} }),
  },
);

function printDiffs(diffs: Diff[]) {
  if (diffs.length == 0) {
    return;
  }

  const table = initTable();
  diffs.forEach(diff => table.push(colorRow(diff)));

  console.log(table.toString());
}

function colorRow(diff: Diff) {
  const oldValues = Object.values(diff.oldEntry);
  const newValues = Object.values(diff.newEntry);

  const color =
    oldValues.every(v => !v) && newValues.some(v => v)
      ? chalk.green
      : oldValues.some(v => v) && newValues.every(v => !v)
        ? chalk.red
        : chalk.yellow;

  const row = [
    diff.feed,
    diff.oldEntry.address,
    diff.newEntry.address,
    diff.oldEntry.decimals !== null ? diff.oldEntry.decimals : '-',
    diff.newEntry.decimals !== null ? diff.newEntry.decimals : '-',
    diff.oldEntry.base,
    diff.newEntry.base,
    diff.oldEntry.quote,
    diff.newEntry.quote,
  ].map(text => color(text));
  return row;
}

function initTable(): Table.Table {
  const wrapWidth = 20;
  return new Table({
    head: [
      'Feed Name',
      'Old Address',
      'New Address',
      'Old Decimals',
      'New Decimals',
      'Old Base Address',
      'New Base Address',
      'Old Quote Address',
      'New Quote Address',
    ],
    style: {
      head: [],
    },
    colWidths: [18, 44, 44, 10, 10, 44, 44, 44, 44],
    wordWrap: true,
  });
}

function getNetworkParameter(): NetworkName {
  const network = process.argv[2];
  if (!network) {
    console.error('Please provide <network> parameter!');
    process.exit(1);
  }
  try {
    return parseNetworkName(network);
  } catch (error) {
    console.error('Network is incorrect/not supported!');
    process.exit(1);
  }
}

async function fetchOldDataFeeds(
  config: SequencerDeploymentConfig,
  network: NetworkName,
): Promise<CompareEntry[]> {
  const { feeds } = await readConfig('feeds_config_v1');
  const oldFeeds = (await getAllowedFeedIds(config, 'feeds_config_v1', network))
    .map(id => feeds.find(feed => feed.id === id))
    .filter(feed => feed !== undefined);
  const deploymentConfig = await readConfig('evm_contracts_deployment_v1');

  const data: CompareEntry[] = [];
  oldFeeds.forEach(feed => {
    const contract = deploymentConfig[
      network
    ]?.contracts.CLAggregatorAdapter.find(
      adapter => adapter.constructorArgs[2] === feed.id,
    );

    data.push({
      description: feed.description,
      decimals: feed.decimals ?? null,
      address: contract?.address ?? null,
      base: contract?.base ?? null,
      quote: contract?.quote ?? null,
    });
  });

  return data;
}

async function fetchNewDataFeeds(
  config: SequencerDeploymentConfig,
  network: NetworkName,
): Promise<CompareEntry[]> {
  const { feeds } = await readConfig('feeds_config_v2');
  const newFeeds = (await getAllowedFeedIds(config, 'feeds_config_v2', network))
    .map(id => feeds.find(feed => feed.id === id))
    .filter(feed => feed !== undefined);

  let deploymentData;
  try {
    deploymentData = await readEvmDeployment(network);
  } catch (error) {
    console.error(`Deployment data for v2 not found for network: '${network}'`);
    deploymentData = [];
  }

  const data: CompareEntry[] = [];
  newFeeds.forEach(feed => {
    const contract = deploymentData?.contracts?.CLAggregatorAdapter[feed.id];
    data.push({
      description: feed.full_name,
      decimals: contract?.constructorArgs[1],
      address: contract?.address ?? null,
      base: contract?.base ?? null,
      quote: contract?.quote ?? null,
    });
  });

  return data;
}

async function getAllowedFeedIds(
  config: SequencerDeploymentConfig,
  configName: 'feeds_config_v1' | 'feeds_config_v2',
  network: NetworkName,
): Promise<readonly number[]> {
  const { feeds } = await readConfig(configName);
  if (!config.providers[network]) return [];

  return config.providers[network]?.allow_feeds?.length
    ? config.providers[network].allow_feeds
    : feeds.map(feed => feed.id);
}

function findDifferences(
  feedsV1: CompareEntry[],
  feedsV2: CompareEntry[],
): Diff[] {
  let temp = feedsV1
    .map(feed => feed.description)
    .concat(feedsV2.map(feed => feed.description));
  const descriptions = Array.from(new Set(temp));

  const diffs: Diff[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const v1 = feedsV1.find(feed => feed.description === descriptions[i]);
    const v2 = feedsV2.find(feed => feed.description === descriptions[i]);
    if (v1 || v2) {
      let oldEntry: DiffEntry = {};
      let newEntry: DiffEntry = {};
      for (const field of fields) {
        oldEntry[field] = v1?.[field] ?? null;
        newEntry[field] = v2?.[field] ?? null;
      }
      diffs.push({
        feed: descriptions[i] as string,
        oldEntry: oldEntry,
        newEntry: newEntry,
      });
    }
  }

  return diffs;
}

async function findFeedsConfigsDiffs(network: NetworkName): Promise<Diff[]> {
  const { feeds: feedsV1 } = await readConfig('feeds_config_v1');
  const { feeds: feedsV2 } = await readConfig('feeds_config_v2');
  const deploymentDataV1 = await readConfig('evm_contracts_deployment_v1');
  const deploymentDataV2 = await readEvmDeployment(network);

  const compareDataV1 = feedsV1.map(feed => {
    const contract = deploymentDataV1[
      network
    ]?.contracts.CLAggregatorAdapter.find(
      adapter => adapter.constructorArgs[2] === feed.id,
    );

    return {
      description: feed.description,
      decimals: feed.decimals ?? null,
      address: contract?.address ?? null,
      base: contract?.base ?? null,
      quote: contract?.quote ?? null,
    };
  });

  const compareDataV2 = feedsV2.map(feed => {
    const contract = deploymentDataV2?.contracts?.CLAggregatorAdapter[feed.id];
    return {
      description: feed.full_name,
      decimals: (contract?.constructorArgs[1] as number) ?? null,
      address: contract?.address ?? null,
      base: contract?.base ?? null,
      quote: contract?.quote ?? null,
    };
  });

  return findDifferences(compareDataV1, compareDataV2);
}

function fetchNewSequencerDeploymentConfig() {
  const url = 'http://sequencer-testnet-001:5556/get_sequencer_config';
  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(
          `Failed to fetch JSON from ${url}; status=${response.status}`,
        );
      }
      return response.json();
    })
    .then(json =>
      S.decodeUnknownSync(ModifiedSequencerDeploymentConfigSchema)(json),
    );
}

// async function main() {
//   const network = getNetworkParameter();

//   const { readJSON } = selectDirectory(configDir);
//   const oldSequencerDeploymentConfig = await readJSON({
//     name: 'sequencer_config_v1',
//     ext: '.json',
//   });

//   const decodedOldConfig = S.decodeSync(
//     ModifiedSequencerDeploymentConfigSchema,
//   )(oldSequencerDeploymentConfig) as SequencerDeploymentConfig;
//   const dataFeedsV1 = await fetchOldDataFeeds(decodedOldConfig, network);

//   const decodedNewConfig = await fetchNewSequencerDeploymentConfig();
//   const dataFeedsV2 = await fetchNewDataFeeds(decodedNewConfig, network);

//   let diffs: Diff[];
//   if (
//     (decodedOldConfig.providers?.[network]?.allow_feeds?.length ?? 0) !== 0 &&
//     (decodedNewConfig.providers?.[network]?.allow_feeds?.length ?? 0) !== 0
//   ) {
//     diffs = findDifferences(dataFeedsV1, dataFeedsV2);
//   } else {
//     console.log('Comparing feeds_config_v1 and feeds_config_v2:');
//     diffs = await findFeedsConfigsDiffs(network);
//   }
//   printDiffs(diffs);
// }

// await main();

const program = Effect.gen(function* (_) {
  const network = yield* _(Effect.sync(() => getNetworkParameter()));

  const { readJSON } = selectDirectory(configDir);

  const oldSequencerDeploymentConfig = yield* _(
    Effect.tryPromise(() =>
      readJSON({
        name: 'sequencer_config_v1',
        ext: '.json',
      }),
    ),
  );

  const decodedOldConfig = yield* _(
    Effect.sync(
      () =>
        S.decodeSync(ModifiedSequencerDeploymentConfigSchema)(
          oldSequencerDeploymentConfig,
        ) as SequencerDeploymentConfig,
    ),
  );

  const dataFeedsV1 = yield* _(
    Effect.tryPromise(() => fetchOldDataFeeds(decodedOldConfig, network)),
  );

  const decodedNewConfig = yield* _(
    Effect.tryPromise(() => fetchNewSequencerDeploymentConfig()),
  );
  const dataFeedsV2 = yield* _(
    Effect.tryPromise(() => fetchNewDataFeeds(decodedNewConfig, network)),
  );

  const oldFeedsLength =
    decodedOldConfig.providers?.[network]?.allow_feeds?.length ?? 0;
  const newFeedsLength =
    decodedNewConfig.providers?.[network]?.allow_feeds?.length ?? 0;

  let diffs: Diff[];

  if (oldFeedsLength !== 0 && newFeedsLength !== 0) {
    diffs = findDifferences(dataFeedsV1, dataFeedsV2);
  } else {
    yield* _(Effect.logInfo('Comparing feeds_config_v1 and feeds_config_v2:'));
    diffs = yield* _(Effect.tryPromise(() => findFeedsConfigsDiffs(network)));
  }

  yield* _(Effect.sync(() => printDiffs(diffs)));
});

NodeRuntime.runMain(program, {
  teardown: () => console.log('Program exiting…'),
});
