import { NewFeed } from '@blocksense/config-types/data-feeds-config';

export type SimplifiedFeed = Omit<
  NewFeed,
  | 'id'
  | 'type'
  | 'valueType'
  | 'consensusAggregation'
  | 'quorumPercentage'
  | 'deviationPercentage'
  | 'skipPublishIfLessThanPercentage'
  | 'alwaysPublishHeartbeatMs'
>;
