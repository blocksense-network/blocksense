import { format } from 'path';
import Web3 from 'web3';

import { selectDirectory } from '@blocksense/base-utils/fs';
import { getEnvString } from '@blocksense/base-utils/env';

import { chainlinkFeedsDir, artifactsDir, configDir } from '../paths';
import {
  collectRawDataFeeds,
  getAllProposedFeedsInRegistry,
} from '../data-services/chainlink_feeds';
import { generateFeedConfig } from '../feeds-config/index';
import { generateChainlinkCompatibilityConfig } from '../chainlink-compatibility/index';
import { decodeUnknownSync } from '@effect/schema/ParseResult';
import type { Schema } from '@effect/schema/Schema';
import { RawDataFeedsSchema } from '../data-services/types';

async function getOrCreateArtifact<A, I>(
  name: string,
  schema: Schema<A, I, never>,
  create: () => Promise<A>,
) {
  const { readJSON, writeJSON } = selectDirectory(artifactsDir);
  const path = format({ dir: artifactsDir, name, ext: '.json' });

  let json: unknown;
  try {
    json = await readJSON({ name });
    console.log(`Loading existing artifact from: '${path}.json'`);
  } catch {
    console.log(`Creating new artifact: '${path}.json'`);
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

  const feedConfig = await generateFeedConfig(rawDataFeeds);

  console.log({ feedConfig });

  const feedRegistryEvents = await getAllProposedFeedsInRegistry(
    new Web3(getEnvString('RPC_URL_ETH_MAINNET')),
    'ethereum-mainnet',
  );

  console.log({ feedRegistryEvents });

  await saveArtifacts({
    name: 'feed_registry_events',
    content: feedRegistryEvents,
  });

  const chainlinkCompatibilityData = await generateChainlinkCompatibilityConfig(
    rawDataFeeds,
    feedConfig,
    feedRegistryEvents,
  );

  await saveConfigs(
    { name: 'feeds_config', content: feedConfig },
    {
      name: 'chainlink_compatibility',
      content: chainlinkCompatibilityData,
    },
  );
}

await main(chainlinkFeedsDir);
