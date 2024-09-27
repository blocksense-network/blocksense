import { format } from 'node:path';

import type { Schema } from '@effect/schema/Schema';
import { decodeUnknownSync } from '@effect/schema/ParseResult';

import { selectDirectory } from '@blocksense/base-utils/fs';

import { ChainlinkCompatibilityConfigSchema } from '@blocksense/config-types/chainlink-compatibility';
import { FeedsConfigSchema } from '@blocksense/config-types/data-feeds-config';

import { chainlinkFeedsDir, artifactsDir, configDir } from '../paths';
import {
  collectRawDataFeeds,
  getAllProposedFeedsInRegistry,
} from '../data-services/chainlink_feeds';
import { RawDataFeedsSchema } from '../data-services/types';
import { generateFeedConfig } from '../feeds-config/index';
import { generateChainlinkCompatibilityConfig } from '../chainlink-compatibility/index';
import { FeedRegistryEventsPerAggregatorSchema } from '../chainlink-compatibility/types';

async function getOrCreateArtifact<A, I>(
  name: string,
  schema: Schema<A, I, never>,
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
    json = await create();
    await writeJSON({ name, content: json });
  }
  return decodeUnknownSync(schema)(json);
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
