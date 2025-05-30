import Table from 'cli-table3';
import { configDir, selectDirectory } from '@blocksense/base-utils';
import { Schema as S } from 'effect';
import { boolean } from 'effect/FastCheck';

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

const fields = ['id', 'full_name'] as const;
type Field = (typeof fields)[number];

// interface DiffEntry {
//   index: number;
//   field: Field;
//   oldValue: string | number;
//   newValue: string | number;
// }

// function printDiffs(diffs: DiffEntry[]) {
//   if (diffs.length == 0) {
//     console.log('finished successfully: no differences found!');
//     return;
//   }

//   const table = initTable();
//   // TODO: impl

//   console.log(table.toString());
// }

// function initTable(): Table.Table {
//   return new Table({
//     head: [
//       'feed name',
//       'old address',
//       'new address',
//       'old base & quote',
//       'new base & quote',
//     ],
//     colWidths: [15, 30, 30, 30, 30],
//     wordWrap: true,
//   });
// }

// const FirstConfigName = 'feeds_config_v2';
// const SecondConfigName = 'feeds_config_v2';
// const oldFeedsConfig = await readConfig(FirstConfigName);
// const newFeedsConfigsConfig = await readConfig(SecondConfigName);

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
  const network = getNetwork();
  const regex = /[-_]/g;

  for (const [key, value] of Object.entries(config.providers)) {
    if (key.replace(regex, '') === network.replace(regex, '')) {
      return value.allow_feeds.length !== 0 ? value.allow_feeds : [];
    }
  }

  console.log('error: no such network!');
  return []; // TODO: process.exit(1)?
}

function getNetwork(): string {
  const network = process.argv[2];

  if (!network) {
    console.error(
      'usage: yarn ts /scripts/compare-feeds-config-versions.ts <network>',
    );
    process.exit(1);
  }

  return network;
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
console.log(oldDeploymentFeedIds);

const decodedNewConfig = S.decodeSync(SequencerDeploymentConfigSchema)(
  newSequencerDeploymentConfig,
) as SequencerDeploymentConfig;
const newDeploymentFeedIds = fetchFeedIds(decodedNewConfig);
console.log(newDeploymentFeedIds);

// const diffs = compareFeeds(firstFileContent, secondFileContent);
// const diffs: DiffEntry[] = [];
// printDiffs(diffs);
