import Table from 'cli-table3';
import {
  configDir,
  NetworkName,
  parseNetworkName,
  selectDirectory,
} from '@blocksense/base-utils';
import { Effect, Schema as S } from 'effect';
import { readConfig, readEvmDeployment } from '@blocksense/config-types';

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
  allow_feeds: S.Array(S.Number),
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
    encode: (outputSchema, _, ast) => {
      const rawProviders: Record<string, Provider> = {};
      for (const [key, value] of Object.entries(outputSchema.providers)) {
        rawProviders[key.replace(/[-]/g, '_')] = value;
      }
      return Effect.succeed({ providers: rawProviders });
    },
  },
);

function printDiffs(diffs: Diff[]) {
  if (diffs.length == 0) {
    return;
  }

  const table = initTable();
  diffs.forEach(diff =>
    table.push([
      diff.feed,
      diff.oldEntry.address,
      diff.newEntry.address,
      diff.oldEntry.decimals,
      diff.newEntry.decimals,
      diff.oldEntry.base,
      diff.newEntry.base,
      diff.oldEntry.quote,
      diff.newEntry.quote,
    ]),
  );

  console.log(table.toString());
}

function initTable(): Table.Table {
  return new Table({
    head: [
      'feed name',
      'old address',
      'new address',
      'old decimals',
      'new decimals',
      'old base',
      'new base',
      'old quote',
      'new quote',
    ],
    colWidths: [18, 30, 30, 4, 4, 30, 30, 30, 30],
    wordWrap: true,
    wrapOnWordBoundary: false,
  });
}

function getNetworkParameter(): NetworkName {
  return parseNetworkName(process.argv[2]);
}

async function fetchOldDataFeeds(
  config: SequencerDeploymentConfig,
): Promise<CompareEntry[]> {
  const network = getNetworkParameter();
  const { feeds } = await readConfig('feeds_config_v1');
  const oldFeeds = config.providers[network].allow_feeds
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
      decimals: feed.decimals,
      address: contract?.address ?? null,
      base: contract?.base ?? null,
      quote: contract?.quote ?? null,
    });
  });

  return data;
}

async function fetchNewDataFeeds(
  config: SequencerDeploymentConfig,
): Promise<CompareEntry[]> {
  const network = getNetworkParameter();

  const { feeds } = await readConfig('feeds_config_v2');
  const newFeeds = config.providers[network].allow_feeds
    .map(id => feeds.find(feed => feed.id === id))
    .filter(feed => feed !== undefined);

  const deploymentData = await readEvmDeployment(network);
  if (!deploymentData) {
    console.error(`Deployment data not found for network: '${network}'`);
    process.exit(1);
  }

  const data: CompareEntry[] = [];
  newFeeds.forEach(feed => {
    const contract = deploymentData.contracts.CLAggregatorAdapter[feed.id];
    data.push({
      description: feed.full_name,
      decimals: contract.constructorArgs[1] as number,
      address: contract.address,
      base: contract.base,
      quote: contract.quote,
    });
  });

  return data;
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
        oldEntry[field] = v1?.[field];
        newEntry[field] = v2?.[field];
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

// -- Execution --
const { readJSON } = selectDirectory(configDir);
const oldSequencerDeploymentConfig = await readJSON({
  name: 'sequencer_config_v1',
  ext: '.json',
});
const newSequencerDeploymentConfig = await readJSON({
  name: 'sequencer_config_v2',
  ext: '.json',
});

const decodedOldConfig = S.decodeSync(ModifiedSequencerDeploymentConfigSchema)(
  oldSequencerDeploymentConfig,
) as SequencerDeploymentConfig;
const dataFeedsV1 = await fetchOldDataFeeds(decodedOldConfig);

const decodedNewConfig = S.decodeSync(ModifiedSequencerDeploymentConfigSchema)(
  newSequencerDeploymentConfig,
) as SequencerDeploymentConfig;
const dataFeedsV2 = await fetchNewDataFeeds(decodedNewConfig);

const diffs = findDifferences(dataFeedsV1, dataFeedsV2);
printDiffs(diffs);
