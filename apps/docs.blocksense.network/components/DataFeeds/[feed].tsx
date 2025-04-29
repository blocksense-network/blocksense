import DATA_FEEDS from '@blocksense/data-feeds-config-generator/feeds_config';
import DEPLOYMENT_INFO from '@/artifacts/deployment_data.json';

import { decodeNewFeedsConfig } from '@blocksense/config-types/data-feeds-config';
import { DeploymentConfigV2 } from '@blocksense/config-types';

import { Error404 } from '@/components/common/Error404';
import { CoreConfigCard } from '@/components/DataFeeds/Cards/CoreConfigCard';
import { PriceFeedConfigCard } from '@/components/DataFeeds/Cards/PriceFeedConfigCard';
import { ConsensusConfigCard } from '@/components/DataFeeds/Cards/ConsensusConfigCard';
import { NetworkAccessCard } from '@/components/DataFeeds/Cards/NetworkAccessCard';
import { OracleConfigCard } from '@/components/DataFeeds/Cards/OracleConfigCard';

import { prepareDeploymentData } from '@/src/deployed-contracts/utils';
import { decodeDeploymentConfigArray } from '@/src/deployed-contracts/types';

export function generateStaticParams() {
  console.log('Generating static params for data feeds...');
  try {
    const feedsConfig = decodeNewFeedsConfig(DATA_FEEDS);
    return feedsConfig.feeds.map(feed => ({
      feed: String(feed.id),
    }));
  } catch (error) {
    console.error('Error decoding feeds config:', error);
    throw error;
  }
}

type DataFeedProps = {
  params: {
    feed: string;
    feedDeploymentInfo: DeploymentConfigV2[];
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
    feed.full_name,
  );

  if (!feedDeploymentInfo) {
    return <Error404 />;
  }

  return (
    <div className="data-feed-details max-w-4xl px-4">
      <h1 className="flex justify-center text-2xl font-bold text-gray-900 mt-10 dark:text-white">
        {feed.full_name} | ID: {feed.id}
      </h1>
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <CoreConfigCard feed={feed} />
        {feed.type === 'price-feed' && <PriceFeedConfigCard feed={feed} />}
        <ConsensusConfigCard feed={feed} />
        <NetworkAccessCard feedsDeploymentInfo={feedDeploymentInfo} />
      </div>
      <div className="flex justify-start 2xl:justify-center">
        <OracleConfigCard feed={feed} />
      </div>
    </div>
  );
}
