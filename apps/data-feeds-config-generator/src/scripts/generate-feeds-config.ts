import { selectDirectory } from '@blocksense/base-utils/fs';

import { chainlinkFeedsDir, artifactsDir, configDir } from '../paths';
import { collectRawDataFeeds } from '../data-services/chainlink_feeds';
import { generateFeedConfig } from '../feeds-config/index';
import { generateChainlinkCompatibilityConfig } from '../chainlink-compatibility/index';

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
  const rawDataFeeds = await collectRawDataFeeds(chainlinkFeedsDir);
  await saveArtifacts({ name: 'raw_chainlink_feeds', content: rawDataFeeds });

  const feedConfig = await generateFeedConfig(rawDataFeeds);

  const chainlinkCompatConfig = await generateChainlinkCompatibilityConfig(
    rawDataFeeds,
    feedConfig,
  );

  await saveConfigs(
    { name: 'feeds_config', content: feedConfig },
    { name: 'chainlink_compatibility', content: chainlinkCompatConfig },
  );
}

await main(chainlinkFeedsDir);
