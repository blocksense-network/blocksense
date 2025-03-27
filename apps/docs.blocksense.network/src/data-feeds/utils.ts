import { keysOf } from '@blocksense/base-utils';
import { NewFeed } from '@blocksense/config-types';

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
