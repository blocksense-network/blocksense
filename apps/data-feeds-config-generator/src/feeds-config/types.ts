import { NewFeed } from '@blocksense/config-types/data-feeds-config';

export type SimplifiedFeed = Pick<
  NewFeed,
  'description' | 'full_name' | 'price_feed_info'
>;
