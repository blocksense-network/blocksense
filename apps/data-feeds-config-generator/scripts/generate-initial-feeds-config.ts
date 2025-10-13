/**
 * @deprecated This script is deprecated and should no longer be used.
 */

import { Schema as S } from 'effect';

import { selectDirectory } from '@blocksense/base-utils/fs';
import { ChainlinkCompatibilityConfigSchema } from '@blocksense/config-types/chainlink-compatibility';
import { NewFeedsConfigSchema } from '@blocksense/config-types/data-feeds-config';

import { generateChainlinkCompatibilityConfig } from '../src/chainlink-compatibility/index';
import { FeedRegistryEventsPerAggregatorSchema } from '../src/chainlink-compatibility/types';
import type { Artifacts } from '../src/data-services/artifacts-downloader';
import { fetchRepoFiles } from '../src/data-services/artifacts-downloader';
import {
  aggregateNetworkInfoPerField,
  collectRawDataFeeds,
  getAllProposedFeedsInRegistry,
} from '../src/data-services/fetchers/chainlink/chainlink_feeds';
import { RawDataFeedsSchema } from '../src/data-services/fetchers/chainlink/types';
import { generateFeedConfig } from '../src/generation/initial/index';
import {
  getAllPossibleCLFeeds,
  getCLFeedsOnMainnet,
} from '../src/generation/initial/utils/chainlink';
import { artifactsDir, configDir } from '../src/paths';

async function createArtifact<T, EncodedT = T>(
  name: string,
  schema: S.Schema<T, EncodedT, never> | null,
  create: () => Promise<T>,
  artifacts: any[],
): Promise<T> {
  const json = await create();
  if (schema) {
    const asserts: (u: unknown) => asserts u is T = S.asserts(schema);
    asserts(json);
    const encoded: EncodedT = S.encodeSync(schema)(json);
    artifacts.push({ name, content: encoded });
  } else {
    artifacts.push({ name, content: json });
  }

  return json as T;
}

async function saveConfigsToDir(
  outputDir: string,
  ...configs: Array<{ name: string; content: any }>
) {
  const { writeJSON } = selectDirectory(outputDir);

  return Promise.all(
    configs.map(cfg =>
      writeJSON(cfg).then(path => console.log(`Saved artifact to: '${path}'`)),
    ),
  );
}

const saveArtifacts = saveConfigsToDir.bind(null, artifactsDir);
const saveConfigs = saveConfigsToDir.bind(null, configDir);

async function main() {
  const artifacts: Artifacts | null = await fetchRepoFiles();

  if (!artifacts) {
    throw new Error('Failed to fetch artifacts');
  }

  const DFCGArtifacts = [];

  const rawDataFeeds = await createArtifact(
    'DFCG_0_raw_chainlink_feeds',
    RawDataFeedsSchema,
    () => collectRawDataFeeds(artifacts.clArtifacts),
    DFCGArtifacts,
  );

  const aggregatedDataFeeds = await createArtifact(
    'DFCG_1_aggregated_chainlink_feeds',
    null,
    async () => aggregateNetworkInfoPerField(rawDataFeeds),
    DFCGArtifacts,
  );

  // Representation of all the Chainlink data feeds in our feed config format.
  const _allPossibleCLDataFeeds = await createArtifact(
    'DFCG_2_chainlink_all_possible_feeds',
    null,
    async () => getAllPossibleCLFeeds(aggregatedDataFeeds),
    DFCGArtifacts,
  );

  // Representation of all the Chainlink data feeds on mainnets in our feed config format.
  const _onMainnetCLDataFeeds = await createArtifact(
    'DFCG_3_chainlink_on_mainnet_feeds',
    null,
    async () => getCLFeedsOnMainnet(rawDataFeeds),
    DFCGArtifacts,
  );

  const feedConfig = await createArtifact(
    'DFCG_4_feeds_config_v2',
    NewFeedsConfigSchema,
    () => generateFeedConfig(rawDataFeeds, artifacts),
    DFCGArtifacts,
  );

  const feedRegistryEvents = await createArtifact(
    'DFCG_5_feed_registry_events',
    FeedRegistryEventsPerAggregatorSchema,
    () => getAllProposedFeedsInRegistry('ethereum-mainnet'),
    DFCGArtifacts,
  );

  const chainlinkCompatConfig = await createArtifact(
    'DFCG_6_chainlink_compatibility_v2',
    ChainlinkCompatibilityConfigSchema,
    () =>
      generateChainlinkCompatibilityConfig(
        rawDataFeeds,
        feedConfig,
        feedRegistryEvents,
      ),
    DFCGArtifacts,
  );

  await saveArtifacts(...DFCGArtifacts);
  await saveConfigs(
    { name: 'feeds_config_v2', content: feedConfig },
    { name: 'chainlink_compatibility_v2', content: chainlinkCompatConfig },
  );
}

await main();
