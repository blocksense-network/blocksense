import Table from 'cli-table3';
import {
  configDir,
  NetworkName,
  parseNetworkName,
  selectDirectory,
} from '@blocksense/base-utils';
import { Schema as S } from 'effect';
import { readConfig, readEvmDeployment } from '@blocksense/config-types';

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
type CompareEntry = {
  [K in Field]: K extends 'decimals' ? number : string | null;
};

// TODO: function feed_config -> CompareEntry

// TODO: separate by OldEntry & NewEntry
type DiffEntry = {
  feed: string;
  oldAddress?: string;
  newAddress?: string;
  oldDecimals?: number;
  newDecimals?: number;
  oldBase?: string;
  newBase?: string;
  oldQuote?: string;
  newQuote?: string;
};

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

function printDiffs(diffs: DiffEntry[]) {
  if (diffs.length == 0) {
    // console.log('Info: no differences found!'); TODO: The cause can be missing feed ids, not diffs
    return;
  }

  const table = initTable();
  diffs.forEach(diff =>
    table.push([
      diff.feed,
      diff.oldAddress,
      diff.newAddress,
      diff.oldDecimals,
      diff.newDecimals,
      diff.oldBase,
      diff.newBase,
      diff.oldQuote,
      diff.newQuote,
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
    colWidths: [15, 30, 30, 5, 5, 30, 30, 30, 30],
    wordWrap: true,
    wrapOnWordBoundary: false,
  });
}

function fetchFeedIds(config: SequencerDeploymentConfig): Readonly<number[]> {
  // const regex = /[_]/g;
  const network = getNetworkParameter();

  // TODO: replace config.providers' network names to "-" instead of "_"
  // return config.providers[network].allow_feeds.length !== 0
  //   ? config.providers[network].allow_feeds
  //   : []; // TODO: if [] return all - that is how the sequencer work
  return [];
}

function getNetworkParameter(): NetworkName {
  return parseNetworkName(process.argv[2]);
}

async function fetchOldDataFeeds(
  feedIds: Readonly<number[]>,
): Promise<CompareEntry[]> {
  const { feeds } = await readConfig('feeds_config_v1');
  const oldFeeds = feedIds
    .map(id => feeds.find(feed => feed.id === id))
    .filter(feed => feed !== undefined);

  const deploymentConfig = await readConfig('evm_contracts_deployment_v1');

  const data: CompareEntry[] = [];
  oldFeeds.forEach(feed => {
    const contract = deploymentConfig[
      getNetworkParameter()
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
  feedIds: Readonly<number[]>,
): Promise<CompareEntry[]> {
  const { feeds } = await readConfig('feeds_config_v2');
  const newFeeds = feedIds
    .map(id => feeds.find(feed => feed.id === id))
    .filter(feed => feed !== undefined);

  const networkName = getNetworkParameter();
  const deploymentData = await readEvmDeployment(networkName);
  if (!deploymentData) {
    console.error(`Deployment data not found for network: '${networkName}'`);
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

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str[0].toUpperCase() + str.slice(1);
}

function findDifferences(
  feedsV1: CompareEntry[],
  feedsV2: CompareEntry[],
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  let temp = feedsV1
    .map(feed => feed.description)
    .concat(feedsV2.map(feed => feed.description));
  const descriptions = Array.from(new Set(temp));

  for (let i = 0; i < descriptions.length; i++) {
    const v1 = feedsV1.find(feed => feed.description === descriptions[i]);
    const v2 = feedsV2.find(feed => feed.description === descriptions[i]);
    if (v1 || v2) {
      let diff: DiffEntry = {
        feed: descriptions[i] as string,
      };
      for (const field of fields) {
        const fieldName = capitalizeFirst(field);
        diff[`old${fieldName}`] = v1?.[field];
        diff[`new${fieldName}`] = v2?.[field];
      }
      diffs.push(diff);
    }
  }
  return diffs;
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

const dataFeedsV1 = await fetchOldDataFeeds(oldDeploymentFeedIds);
const dataFeedsV2 = await fetchNewDataFeeds(newDeploymentFeedIds);
const diffs = findDifferences(dataFeedsV1, dataFeedsV2);
printDiffs(diffs);
