import Table from 'cli-table3';
import {
  configDir,
  NetworkName,
  parseNetworkName,
  selectDirectory,
} from '@blocksense/base-utils';
import { Schema as S } from 'effect';
import {
  readConfig,
  FeedSchema,
  configDirs,
  DeploymentConfigSchemaV2,
  readEvmDeployment,
} from '@blocksense/config-types';

/**
 * Overall algorithm:
 * * For both v1 and v2:
 *   * read the corresponding sequnecer config file
 *   * for each network in the sequencer config file, read the allowed feeds
 *   * for each allowed feed, read its data from feeds_config_{v1 or v2} and extract the follwoging fields:
 *     * feed id
 *     * name/full_name/description
 *     * decimals
 *   * for each allowed feed read its address, base and quote from evm_contracts_deployment_{v1 or v2}
 *
 * * Then match the old and new feeds based on their description (v1) and full_name (v2)
 *
 * Table:
 * feed name | old address | new address | old decimals | new decimals | old base & quote | new base & quote
 */

const fields = ['description', 'address', 'decimals', 'base', 'quote'] as const;
type Field = (typeof fields)[number];

interface DiffEntry {
  index: number;
  field: Field;
  oldValue: string | number;
  newValue: string | number;
}

function printDiffs(diffs: DiffEntry[]) {
  if (diffs.length == 0) {
    console.log('Info: no differences found!');
    return;
  }

  const table = initTable();
  // TODO: impl

  console.log(table.toString());
}

function initTable(): Table.Table {
  return new Table({
    head: [
      'feed name',
      'old address',
      'new address',
      'old base',
      'new base',
      'old quote',
      'new quote',
    ],
    colWidths: [15, 30, 30, 30, 30, 30, 30],
    wordWrap: true,
  });
}

const SequencerDeploymentConfigSchema = S.Struct({
  providers: S.Record({
    key: S.String,
    value: S.mutable(
      S.Struct({
        allow_feeds: S.Array(S.Number),
      }),
    ),
  }),
});

type SequencerDeploymentConfig = typeof SequencerDeploymentConfigSchema.Type;

function fetchFeedIds(config: SequencerDeploymentConfig): Readonly<number[]> {
  const network = getNetworkParameter();
  const regex = /[-_]/g;

  for (const [key, value] of Object.entries(config.providers)) {
    if (key.replace(regex, '') === network.replace(regex, '')) {
      return value.allow_feeds.length !== 0 ? value.allow_feeds : [];
    }
  }

  throw new Error('No such network!');
}

function getNetworkParameter(): NetworkName {
  return parseNetworkName(process.argv[2]);
}

type CompareEntry = {
  [K in Field]: K extends 'decimals' ? number : string | null;
};

async function fetchOldDataFeeds(
  feedIds: Readonly<number[]>,
): Promise<CompareEntry[]> {
  const configName = 'feeds_config_v1';
  const { feeds } = await readConfig(configName);
  const oldFeeds = feedIds
    .map(id => feeds.find(feed => feed.id === id))
    .filter(feed => feed !== undefined);

  const EvmConfigName = 'evm_contracts_deployment_v1';
  const evmConfig = await readConfig(EvmConfigName);

  const data: CompareEntry[] = [];
  oldFeeds.forEach(feed => {
    const contract = evmConfig[
      getNetworkParameter()
    ]?.contracts.CLAggregatorAdapter.find(
      adapter => adapter.constructorArgs[2] === feed.id,
    );

    data.push({
      description: feed.description,
      decimals: feed.decimals,
      address: contract?.address.toString() ?? null,
      base: contract?.base?.toString() ?? null,
      quote: contract?.quote?.toString() ?? null,
    });
  });

  return data;
}

async function fetchNewDataFeeds(
  feedIds: Readonly<number[]>,
): Promise<CompareEntry[]> {
  const configName = 'feeds_config_v2';
  const { feeds } = await readConfig(configName);
  const newFeeds = feedIds
    .map(id => feeds.find(feed => feed.id === id))
    .filter(feed => feed !== undefined);

  const deploymentData = await readEvmDeployment(getNetworkParameter());

  const data: CompareEntry[] = [];
  // newFeeds.forEach(feed => { // TODO: EDIT
  //   const contract = deploymentData.contracts[
  //     getNetworkParameter()
  //   ]?.contracts.CLAggregatorAdapter.find(
  //     adapter => adapter.constructorArgs[2] === feed.id,
  //   );

  //   data.push({
  //     description: feed.description,
  //     decimals: 0,
  //     address: contract?.address.toString() ?? null,
  //     base: contract?.base?.toString() ?? null,
  //     quote: contract?.quote?.toString() ?? null,
  //   });
  // });

  return data;
}

// -- execution part --
const { readJSON } = selectDirectory(configDir);
const oldSequencerDeploymentConfig = await readJSON({
  name: 'sequencer_config_v1',
  ext: '.json',
});
const newSequencerDeploymentConfig = await readJSON({
  name: 'sequencer_config_v2',
  ext: '.json',
});

const decodedOldConfig = S.decodeSync(SequencerDeploymentConfigSchema)(
  oldSequencerDeploymentConfig,
) as SequencerDeploymentConfig;
const oldDeploymentFeedIds = fetchFeedIds(decodedOldConfig);

const decodedNewConfig = S.decodeSync(SequencerDeploymentConfigSchema)(
  newSequencerDeploymentConfig,
) as SequencerDeploymentConfig;
const newDeploymentFeedIds = fetchFeedIds(decodedNewConfig);

// const diffs = compareFeeds(...);
const dataV2 = await fetchNewDataFeeds(newDeploymentFeedIds);
dataV2.forEach(el => console.log(JSON.stringify(el)));
const diffs: DiffEntry[] = [];
// printDiffs(diffs);
