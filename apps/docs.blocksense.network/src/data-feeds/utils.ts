import { keysOf } from '@blocksense/base-utils';
import { decodeNewFeedsConfig, NewFeed } from '@blocksense/config-types';
import DATA_FEEDS from '@blocksense/data-feeds-config-generator/feeds_config';

export function getFeedsConfig() {
  const feedsConfig = decodeNewFeedsConfig(DATA_FEEDS);
  return {
    priceFeeds: {
      feeds: feedsConfig.feeds.filter(feed => feed.type === 'price-feed'),
    },
  };
}

export function getDataSources(feed: NewFeed) {
  switch (feed.oracle_id) {
    case 'crypto-price-feeds':
      return keysOf((feed.additional_feed_info.arguments as any)['exchanges']);
    case 'gecko-terminal':
      return ['CoinGecko'];
    default:
      return [];
  }
}
