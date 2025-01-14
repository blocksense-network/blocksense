import React from 'react';
import DATA_FEEDS from '@blocksense/monorepo/feeds_config';
import CONTRACTS_DEPLOYMENT_CONFIG from '@blocksense/monorepo/evm_contracts_deployment_v1';
import {
  decodeFeedsConfig,
  Feed,
} from '@blocksense/config-types/data-feeds-config';
import {
  CLAggregatorAdapterData,
  decodeDeploymentConfig,
} from '@blocksense/config-types/evm-contracts-deployment';

import { DataFeedPageClient } from '@/components/DataFeeds/[feed-client]';
import { Error404 } from '@/components/common/Error404';

export function generateStaticParams() {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  return feedsConfig.feeds.map(feed => ({
    feed: String(feed.id),
  }));
}

interface Params {
  feed: string;
}

export default async function DataFeedPage({ params }: { params: Params }) {
  const { feed: feedId } = await params;

  if (!feedId) {
    return <Error404 />;
  }

  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  const feedsDeploymentInfo = decodeDeploymentConfig(
    CONTRACTS_DEPLOYMENT_CONFIG,
  )['ethereum-sepolia']?.contracts?.CLAggregatorAdapter;
  const feed = feedsConfig.feeds.find(feed => feed.id === Number(feedId));

  if (!feed) {
    return <Error404 />;
  }

  const feedDeploymentInfo = feedsDeploymentInfo?.find(
    (info: CLAggregatorAdapterData) => info.description === feed.description,
  );

  if (!feedDeploymentInfo) {
    throw new Error(
      `No deployment info found for feed: ${feed.description} (${feed.id})`,
    );
  }

  return (
    <DataFeedPageClient feed={feed} feedDeploymentInfo={feedDeploymentInfo} />
  );
}
