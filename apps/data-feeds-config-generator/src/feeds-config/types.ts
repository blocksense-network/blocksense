import { NewFeed } from '@blocksense/config-types/data-feeds-config';

export type SimplifiedFeed = Pick<
  NewFeed,
  'description' | 'full_name' | 'additional_feed_info'
>;

export type SimplifiedFeedWithRank = SimplifiedFeed & { rank: number | null };
