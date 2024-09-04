import { rootDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';

import { artifactsDir, chainlinkFeedsDir } from '../paths';
import { collectRawDataFeeds } from '../data-services/chainlink_feeds';
import { generateFeedConfig } from '../feeds-config/index';
import { FeedsConfig } from '../feeds-config/types';

async function writeFeedConfigToFile(
  feedConfig: FeedsConfig,
  filePath: string,
) {
  const { writeJSON } = selectDirectory(filePath);

  await writeJSON({
    content: feedConfig,
    name: 'feeds_config',
  });
}

async function main(chainlinkFeedsDir: string) {
  const rawDataFeeds = await collectRawDataFeeds(chainlinkFeedsDir);

  const feedConfig = await generateFeedConfig(rawDataFeeds);

  await writeFeedConfigToFile(feedConfig, artifactsDir);
  await writeFeedConfigToFile(feedConfig, `${rootDir}/config`);
}

await main(chainlinkFeedsDir);
