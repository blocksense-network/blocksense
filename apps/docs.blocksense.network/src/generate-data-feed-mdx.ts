import {
  decodeFeedsConfig,
  FeedsConfig,
} from '@blocksense/config-types/data-feeds-config';
import {
  ChainlinkProxyData,
  decodeDeploymentConfig,
} from '@blocksense/config-types/evm-contracts-deployment';
import { assertNotNull, selectDirectory } from '@blocksense/base-utils';

import { stringifyObject } from '@/src/utils';

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

async function generateDataFeedsPages() {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  const feedsDeploymentInfo = assertNotNull(
    decodeDeploymentConfig(CONTRACTS_DEPLOYMENT_CONFIG)['ethereum-sepolia'],
  ).contracts.ChainlinkProxy;

  await generateDataFeedsOverviewFile(feedsConfig);
}

generateDataFeedsPages()
  .then(() => console.log('Data Feeds Pages generated!'))
  .catch(err => {
    console.log(`DFP generation error: ${err}`);
  });
