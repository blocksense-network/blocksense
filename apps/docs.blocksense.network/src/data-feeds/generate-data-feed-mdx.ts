import {
  decodeFeedsConfig,
  Feed,
} from '@blocksense/data-feeds-config-generator';
import { selectDirectory } from '@blocksense/base-utils';

import { stringifyObject } from '@/src/utils';
import { pagesDataFeedsFolder } from '@/src/constants';

import DATA_FEEDS from '@blocksense/monorepo/feeds_config';

type DataFeedOverview = {
  id: number;
  name: string;
  description: string;
  decimals: number;
  report_interval_ms: number;
  script: string;
};

function generateMarkdownContent(): string {
  const dataFeeds = decodeFeedsConfig(DATA_FEEDS);

  const dataFeedsOverview: DataFeedOverview[] = dataFeeds.feeds.map(
    (feed: Feed) => ({
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
import { DataFeeds } from '@/components/DataFeeds/DataFeeds';

<DataFeeds dataFeedsOverviewString={${dataFeedsOverviewString}}/>
`;

  return content;
}

function generateDataFeedsFile(): Promise<string[]> {
  const mdxFile = {
    name: 'overview',
    content: generateMarkdownContent(),
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

generateDataFeedsFile()
  .then(() => console.log('Data Feed Overview Page generated!'))
  .catch(err => {
    console.log(err);
  });
