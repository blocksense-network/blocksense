import { keysOf } from '@blocksense/base-utils/array-iter';
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
    case 'cex-price-feeds':
      const exchanges = (feed.additional_feed_info.arguments as any)[
        'exchanges'
      ];
      const dataSources = exchanges ? keysOf(exchanges) : ['No data providers'];
      return dataSources;
    case 'gecko-terminal':
      return ['CoinGecko'];
    default:
      return [];
  }
}
