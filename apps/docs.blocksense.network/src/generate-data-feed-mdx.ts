import {
  decodeFeedsConfig,
  FeedsConfig,
} from '@blocksense/config-types/data-feeds-config';

import { selectDirectory } from '@blocksense/base-utils';

import { stringifyObject } from '@/src/utils';

import { pagesDataFeedsFolder } from '@/src/constants';

import DATA_FEEDS from '@blocksense/monorepo/feeds_config';

function generateOverviewMarkdownContent(feedsConfig: FeedsConfig): string {
  const dataFeedsOverviewString = stringifyObject(feedsConfig);

  const content = `
import { DataFeeds } from '@/components/DataFeeds/DataFeeds';

<DataFeeds dataFeedsOverviewString={${dataFeedsOverviewString}}/>
`;

  return content;
}

async function generateDataFeedsOverviewFile(
  feedsConfig: FeedsConfig,
): Promise<string> {
  const mdxFile = {
    name: 'overview',
    content: generateOverviewMarkdownContent(feedsConfig),
  };

  const { write } = selectDirectory(pagesDataFeedsFolder);

  return write({ ext: '.mdx', ...mdxFile });
}

async function generateDataFeedsPages() {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  await generateDataFeedsOverviewFile(feedsConfig);
}

generateDataFeedsPages()
  .then(() => console.log('Data Feeds Pages generated!'))
  .catch(err => {
    console.log(`DFP generation error: ${err}`);
  });
