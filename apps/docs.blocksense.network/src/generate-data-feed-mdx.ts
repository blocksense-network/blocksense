import {
  decodeFeedsConfig,
  Feed,
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
): Promise<string[]> {
  const mdxFile = {
    name: 'overview',
    content: generateOverviewMarkdownContent(feedsConfig),
  };

  const { write, writeJSON } = selectDirectory(pagesDataFeedsFolder);

  return Promise.all([
    write({ ext: '.mdx', ...mdxFile }),
    writeJSON({
      base: '_meta.json',
      content: { overview: 'Overview' },
    }),
  ]);
}

function generateIndividualDataFeedPageContent(feed: Feed): string {
  const content = `
  # Data Feed: '${feed.description}' with ID: ${feed.id}
  ### Decimals
  ${feed.decimals}
  ### Report Interval
  ${feed.report_interval_ms}
  ### Script
  ${feed.script}
  `;
  return content;
}

async function generateIndividualDataFeedPages(
  feedsConfig: FeedsConfig,
): Promise<any> {
  const feedsFolder = `${pagesDataFeedsFolder}/feed`;
  const { write, writeJSON } = selectDirectory(feedsFolder);

  const dataFeedPages = feedsConfig.feeds.map((feed: Feed) => {
    return {
      description: feed.description,
      name: `${feed.id}`,
      content: generateIndividualDataFeedPageContent(feed),
    };
  });

  const metaJSON = dataFeedPages.reduce(
    (obj, { name, description }) => ({
      ...obj,
      [name]: {
        title: description,
        display: 'hidden',
      },
    }),
    {},
  );

  const { writeJSON: writeRootMetaFile, readJSON } =
    selectDirectory(pagesDataFeedsFolder);

  let rootMetaFileContent = await readJSON({ name: '_meta' });
  rootMetaFileContent = {
    ...rootMetaFileContent,
    feed: {
      title: 'Supported Data Feeds',
      display: 'children',
    },
  };

  return Promise.all([
    ...dataFeedPages.map(args => write({ ext: '.mdx', ...args })),
    writeJSON({
      base: '_meta.json',
      content: metaJSON,
    }),
    writeRootMetaFile({
      base: '_meta.json',
      content: rootMetaFileContent,
    }),
  ]);
}

async function generateDataFeedsPages() {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);

  await generateDataFeedsOverviewFile(feedsConfig);
  await generateIndividualDataFeedPages(feedsConfig);
}

generateDataFeedsPages()
  .then(() => console.log('Data Feeds Pages generated!'))
  .catch(err => {
    console.log(`DFP generation error: ${err}`);
  });
