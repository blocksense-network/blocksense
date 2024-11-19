import * as S from '@effect/schema/Schema';

import { FeedSchema } from '@blocksense/config-types/data-feeds-config';
import { CLAggregatorAdapterDataSchema } from '@blocksense/config-types/evm-contracts-deployment';

const IndividualDataFeedPageDataSchema = S.Struct({
  feed: FeedSchema,
  contracts: CLAggregatorAdapterDataSchema,
});

export type IndividualDataFeedPageData = S.Schema.Type<
  typeof IndividualDataFeedPageDataSchema
>;

export const decodeIndividualDataFeedPageData = S.decodeUnknownSync(
  IndividualDataFeedPageDataSchema,
);
