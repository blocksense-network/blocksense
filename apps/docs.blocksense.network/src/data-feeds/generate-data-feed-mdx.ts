import networks from './deploymentV1.json';
import dataFeeds from '../../../../libs/feed_registry/feeds_config.json';

import { selectDirectory } from '@blocksense/base-utils';
import { ChainId } from '@blocksense/base-utils/evm-utils';
import { stringifyObject } from '../utils';
import { pagesDataFeedsFolder } from '../constants';

type DataFeedOverview = {
  id: string;
  name: string;
  description: string;
  decimals: number;
  report_interval_ms: number;
  script: string;
};

function generateMarkdownContent(networks: any, dataFeeds: any): string {
  const networksJsonString = stringifyObject(networks);
  const dataFeedsJsonString = stringifyObject(dataFeeds);

  const dataFeedsOverview: DataFeedOverview[] = dataFeeds.feeds.map(
    (feed: any) => ({
      id: feed.id,
      name: feed.name,
      description: feed.description,
      decimals: feed.decimals,
      report_interval_ms: feed.report_interval_ms,
      script: feed.script,
    }),
  );

  const dataFeedsOverviewString = stringifyObject(dataFeedsOverview);

  const content = `
import { DataFeeds } from '@/components/data-feeds/DataFeeds';

<DataFeeds dataFeedsOverviewString={${dataFeedsOverviewString}}/>
`;

  return content;
}

function generateDataFeedsFile(): Promise<string> {
  const mdxFile = {
    name: 'data-feeds-overview',
    content: generateMarkdownContent(networks, dataFeeds),
  };

  const { write } = selectDirectory(pagesDataFeedsFolder);

  return write({ ext: '.mdx', ...mdxFile });
}

generateDataFeedsFile()
  .then(() => console.log('Data Feed Page generated!'))
  .catch(err => {
    console.log(err);
  });
