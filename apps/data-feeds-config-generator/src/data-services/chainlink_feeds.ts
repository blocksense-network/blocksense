import { selectDirectory } from '@blocksense/base-utils/fs';

import { RawDataFeeds, decodeChainLinkFeedsInfo } from './types';
import { artifactsDir } from '../paths';

export async function collectRawDataFeeds(directoryPath: string) {
  const { readAllJSONFiles } = selectDirectory(directoryPath);

  const rawDataFeeds: RawDataFeeds = {};

  for (const { base, content } of await readAllJSONFiles()) {
    const info = decodeChainLinkFeedsInfo(content);

    for (const feed of info) {
      const feedName = feed.name;
      rawDataFeeds[feedName] ??= { networks: {} };
      if (rawDataFeeds[feedName].networks[base]) {
        console.error(`Duplicate feed for '${feedName}' on network '${base}'`);
      }
      rawDataFeeds[feedName].networks[base] = feed;
    }
  }

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: rawDataFeeds,
      name: 'raw_chainlink_feeds',
    });
  }

  return rawDataFeeds;
}
