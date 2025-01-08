import { format } from 'node:path';

import { Schema, ParseResult } from 'effect';
const { decodeUnknownSync } = ParseResult;

import { selectDirectory } from '@blocksense/base-utils/fs';

import { ChainlinkCompatibilityConfigSchema } from '@blocksense/config-types/chainlink-compatibility';
import { FeedsConfigSchema } from '@blocksense/config-types/data-feeds-config';

import { chainlinkFeedsDir, artifactsDir, configDir } from '../paths';
import {
  collectRawDataFeeds,
  aggregateNetworkInfoPerField,
  getAllProposedFeedsInRegistry,
} from '../data-services/chainlink_feeds';
import { RawDataFeedsSchema } from '../data-services/types';
import { generateFeedConfig } from '../feeds-config/index';
import { generateChainlinkCompatibilityConfig } from '../chainlink-compatibility/index';
import { FeedRegistryEventsPerAggregatorSchema } from '../chainlink-compatibility/types';

async function getOrCreateArtifact<A, I = A>(
  name: string,
  schema: Schema.Schema<A, I, never> | null,
  create: () => Promise<A>,
) {
  const { readJSON, writeJSON } = selectDirectory(artifactsDir);
  const path = format({ dir: artifactsDir, name, ext: '.json' });

  let json: unknown;
  try {
    if (process.env['ENABLE_CACHE'] ?? false) {
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

  const feedConfig = await getOrCreateArtifact(
    'feeds_config',
    FeedsConfigSchema,
    () => generateFeedConfig(rawDataFeeds),
  );

  const feedRegistryEvents = await getOrCreateArtifact(
    'feed_registry_events',
    FeedRegistryEventsPerAggregatorSchema,
    () => getAllProposedFeedsInRegistry('ethereum-mainnet'),
  );

  const chainlinkCompatConfig = await getOrCreateArtifact(
    'chainlink_compatibility',
    ChainlinkCompatibilityConfigSchema,
    () =>
      generateChainlinkCompatibilityConfig(
        rawDataFeeds,
        feedConfig,
        feedRegistryEvents,
      ),
  );

  await saveConfigs(
    { name: 'feeds_config', content: feedConfig },
    { name: 'chainlink_compatibility', content: chainlinkCompatConfig },
  );
}

await main(chainlinkFeedsDir);
