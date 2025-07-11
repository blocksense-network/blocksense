import DATA_FEEDS from '@blocksense/data-feeds-config-generator/feeds_config';
import DEPLOYMENT_INFO from '@/artifacts/deployment_data.json';

import { decodeNewFeedsConfig } from '@blocksense/config-types/data-feeds-config';

import { Error404 } from '@/components/common/Error404';
import { CoreConfigCard } from '@/components/DataFeeds/Cards/CoreConfigCard';
import { PriceFeedConfigCard } from '@/components/DataFeeds/Cards/PriceFeedConfigCard';
import { ConsensusConfigCard } from '@/components/DataFeeds/Cards/ConsensusConfigCard';
import { NetworkAccessCard } from '@/components/DataFeeds/Cards/NetworkAccessCard';
import { OracleConfigCard } from '@/components/DataFeeds/Cards/OracleConfigCard';

import { prepareDeploymentData } from '@/src/deployed-contracts/utils';
import { decodeDeploymentConfigArray } from '@/src/deployed-contracts/types';

export function generateStaticParams(): { feed: string }[] {
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
  const feed = feedsConfig.feeds.find(feed => feed.id.toString() === feedId);

  if (!feed) {
    return <Error404 />;
  }

  const feedDeploymentInfo = prepareDeploymentData(
    decodeDeploymentConfigArray(DEPLOYMENT_INFO),
    String(feed.id),
  );

  if (!feedDeploymentInfo) {
    return <Error404 />;
  }

  return (
    <>
      <h1 className="flex justify-center text-2xl font-bold text-gray-900 mb-4 dark:text-white">
        {feed.full_name} | ID: {feed.id}
      </h1>
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <CoreConfigCard feed={feed} />
        {feed.type === 'price-feed' && <PriceFeedConfigCard feed={feed} />}
        <ConsensusConfigCard feed={feed} />
        <NetworkAccessCard feedsDeploymentInfo={feedDeploymentInfo} />
        <section className="col-span-full">
          <OracleConfigCard feed={feed} />
        </section>
      </div>
    </>
  );
}
