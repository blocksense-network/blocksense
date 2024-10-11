import {
  decodeFeedsConfig,
  Feed,
  FeedsConfig,
} from '@blocksense/config-types/data-feeds-config';
import {
  ChainlinkProxyData,
  decodeDeploymentConfig,
} from '@blocksense/config-types/evm-contracts-deployment';
import { assertNotNull, selectDirectory } from '@blocksense/base-utils';

import { stringifyObject } from '@/src/utils';
import { updateMetaJsonFile } from '@/src/utils-fs';

import { pagesDataFeedsFolder } from '@/src/constants';

import { IndividualDataFeedPageData } from './generate-data-feed-mdx-types';

import DATA_FEEDS from '@blocksense/monorepo/feeds_config';
import CONTRACTS_DEPLOYMENT_CONFIG from '@blocksense/monorepo/evm_contracts_deployment_v1';

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
    updateMetaJsonFile(pagesDataFeedsFolder, { overview: 'Overview' }),
  ]);
}

function generateIndividualDataFeedPageContent(
  feedData: IndividualDataFeedPageData,
): string {
  const dataFeedString = stringifyObject(feedData);

  const content = `
---
title: ${feedData.feed.description} | ${feedData.feed.id}
---

import { DataFeedDetails } from '@/components/DataFeeds/DataFeedDetails';

<DataFeedDetails
  feedJsonString={${dataFeedString}}
/>
`;

  return content;
}

async function generateIndividualDataFeedPages(
  feedsConfig: FeedsConfig,
  feedsDeploymentInfo: ChainlinkProxyData[],
): Promise<any> {
  const feedsFolder = `${pagesDataFeedsFolder}/feed`;
  const { write, writeJSON } = selectDirectory(feedsFolder);

  const dataFeedPages = feedsConfig.feeds.map((feed: Feed) => {
    const feedDeploymentInfo = feedsDeploymentInfo.find(
      (info: ChainlinkProxyData) => info.description === feed.description,
    );

    if (!feedDeploymentInfo) {
      throw new Error(
        `No deployment info found for feed: ${feed.description} (${feed.id})`,
      );
    }

    return {
      description: feed.description,
      name: `${feed.id}`,
      content: generateIndividualDataFeedPageContent({
        feed: feed,
        contracts: feedDeploymentInfo,
      }),
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
    updateMetaJsonFile(pagesDataFeedsFolder, {
      feed: {
        title: 'Supported Data Feeds',
        display: 'children',
      },
    }),
  ]);
}

async function generateDataFeedsPages() {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  const feedsDeploymentInfo = assertNotNull(
    decodeDeploymentConfig(CONTRACTS_DEPLOYMENT_CONFIG)['ethereum-sepolia'],
  ).contracts.ChainlinkProxy;

  await generateDataFeedsOverviewFile(feedsConfig);
  await generateIndividualDataFeedPages(feedsConfig, feedsDeploymentInfo);
}

generateDataFeedsPages()
  .then(() => console.log('Data Feeds Pages generated!'))
  .catch(err => {
    console.log(`DFP generation error: ${err}`);
  });
