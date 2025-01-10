import { format } from 'node:path';

import type { Schema } from '@effect/schema/Schema';
import { decodeUnknownSync } from '@effect/schema/ParseResult';

import { selectDirectory } from '@blocksense/base-utils/fs';

import { ChainlinkCompatibilityConfigSchema } from '@blocksense/config-types/chainlink-compatibility';
import {
  FeedsConfigSchema,
  NewFeedsConfigSchema,
} from '@blocksense/config-types/data-feeds-config';

import { chainlinkFeedsDir, artifactsDir, configDir } from '../paths';
import {
  collectRawDataFeeds,
  aggregateNetworkInfoPerField,
  getAllProposedFeedsInRegistry,
} from '../data-services/chainlink_feeds';
import { RawDataFeedsSchema } from '../data-services/types';
import {
  generateFeedConfig,
  getAllPossibleCLFeeds,
  getCLFeedsOnMainnet,
} from '../feeds-config/index';
import { generateChainlinkCompatibilityConfig } from '../chainlink-compatibility/index';
import { FeedRegistryEventsPerAggregatorSchema } from '../chainlink-compatibility/types';

async function getOrCreateArtifact<A, I = A>(
  name: string,
  schema: Schema<A, I, never> | null,
  create: () => Promise<A>,
) {
  const { readJSON, writeJSON } = selectDirectory(artifactsDir);
  const path = format({ dir: artifactsDir, name, ext: '.json' });

  let json: unknown;
  try {
    if (process.env['ENABLE_CACHE'] ?? false) {
      console.log(process.env['ENABLE_CACHE']);
      json = await readJSON({ name });
      console.log(`Loading existing artifact from: '${path}'`);
    }
    throw new Error('Skipping cache');
  } catch {
    console.log(`Creating new artifact: '${path}'`);
    const startTime = performance.now();
    json = await create();
    const delta = performance.now() - startTime;
    await writeJSON({ name, content: json });
    console.log(`Artifact '${path}' created in ${delta.toFixed(2)}ms`);
  }
  return schema ? decodeUnknownSync(schema)(json) : (json as A);
}

async function saveConfigsToDir(
  outputDir: string,
  ...configs: { name: string; content: any }[]
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

async function main(chainlinkFeedsDir: string) {
  const rawDataFeeds = await getOrCreateArtifact(
    'raw_chainlink_feeds',
    RawDataFeedsSchema,
    () => collectRawDataFeeds(chainlinkFeedsDir),
  );

  const aggregatedDataFeeds = await getOrCreateArtifact(
    'aggregated_chainlink_feeds',
    null,
    async () => aggregateNetworkInfoPerField(rawDataFeeds),
  );

  // Representation of all the Chainlink data feeds in our feed config format.
  const allPossibleCLDataFeeds = await getOrCreateArtifact(
    'step_1_chainlink_all_possible_feeds',
    null,
    async () => getAllPossibleCLFeeds(aggregatedDataFeeds),
  );

  // Representation of all the Chainlink data feeds on mainnets in our feed config format.
  const onMainnetCLDataFeeds = await getOrCreateArtifact(
    'step_2_chainlink_on_mainnet_feeds',
    null,
    async () => getCLFeedsOnMainnet(rawDataFeeds),
  );

  const feedConfig = await getOrCreateArtifact(
    'feeds_config_new',
    NewFeedsConfigSchema,
    () => generateFeedConfig(rawDataFeeds),
  );

  // const x = feedConfig.feeds.map(f => {
  //   const providers = Object.keys(f.priceFeedInfo.providers);
  //   return {
  //     name: `${f.priceFeedInfo.pair.base} / ${f.priceFeedInfo.pair.quote}`,
  //     providers: providers,
  //   };
  // });

  // await getOrCreateArtifact('x', null, async () => x);

  const feedRegistryEvents = await getOrCreateArtifact(
    'feed_registry_events',
    FeedRegistryEventsPerAggregatorSchema,
    () => getAllProposedFeedsInRegistry('ethereum-mainnet'),
  );

  const chainlinkCompatConfig = await getOrCreateArtifact(
    'chainlink_compatibility_new',
    ChainlinkCompatibilityConfigSchema,
    () =>
      generateChainlinkCompatibilityConfig(
        rawDataFeeds,
        feedConfig,
        feedRegistryEvents,
      ),
  );

  await saveConfigs(
    { name: 'feeds_config_new', content: feedConfig },
    { name: 'chainlink_compatibility_new', content: chainlinkCompatConfig },
  );
}

await main(chainlinkFeedsDir);
