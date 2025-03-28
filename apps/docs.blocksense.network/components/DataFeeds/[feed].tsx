import DATA_FEEDS from '@blocksense/data-feeds-config-generator/feeds_config';
import { decodeNewFeedsConfig } from '@blocksense/config-types/data-feeds-config';

import { Error404 } from '@/components/common/Error404';
import { CoreConfigCard } from '@/components/DataFeeds/Cards/CoreConfigCard';
import { PriceFeedConfigCard } from '@/components/DataFeeds/Cards/PriceFeedConfigCard';
import { ConsensusConfigCard } from '@/components/DataFeeds/Cards/ConsensusConfigCard';
import { NetworkAccessCard } from '@/components/DataFeeds/Cards/NetworkAccessCard';
import { OracleConfigCard } from '@/components/DataFeeds/Cards/OracleConfigCard';

import { prepareDeploymentData } from '@/src/deployed-contracts/utils';

export function generateStaticParams() {
  const feedsConfig = decodeNewFeedsConfig(DATA_FEEDS);
  return feedsConfig.feeds.map(feed => ({
    feed: String(feed.id),
  }));
}

type DataFeedProps = {
  params: {
    feed: string;
  };
};

export default async function DataFeed({ params }: DataFeedProps) {
  const { feed: feedId } = await params;

  if (!feedId) {
    return <Error404 />;
  }

  const feedsConfig = decodeNewFeedsConfig(DATA_FEEDS);
  const feed = feedsConfig.feeds.find(feed => feed.id === Number(feedId));

  if (!feed) {
    return <Error404 />;
  }

  const feedsDeploymentInfo = await prepareDeploymentData(feed.full_name);

  if (!feedsDeploymentInfo) {
    return <Error404 />;
  }

  return (
    <div className="data-feed-details px-4">
      <h1 className="flex justify-center text-2xl font-bold text-gray-900 mt-10 dark:text-white">
        {feed.full_name} | ID: {feed.id}
      </h1>

      <div className="pl-10 grid justify-center grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4 max-w-screen-lg mx-auto">
        <CoreConfigCard feed={feed} />

        {feed.type === 'price-feed' && <PriceFeedConfigCard feed={feed} />}

        <ConsensusConfigCard feed={feed} />
        <NetworkAccessCard feedsDeploymentInfo={feedsDeploymentInfo} />
      </div>
      <div className="flex lg:justify-center">
        <OracleConfigCard feed={feed} />
      </div>
    </div>
  );
}
