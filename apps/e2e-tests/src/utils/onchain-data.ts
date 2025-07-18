import { fromEntries } from '@blocksense/base-utils/array-iter';
import type { AggregatedDataFeedStoreConsumer } from '@blocksense/contracts/viem';

export async function getPricesInfo(
  feedIds: Array<bigint>,
  ADFSConsumer: AggregatedDataFeedStoreConsumer,
): Promise<Record<string, number>> {
  return fromEntries(
    await Promise.all(
      feedIds.map(async feedId => [
        feedId.toString(),
        await ADFSConsumer.getLatestSingleData(feedId).then(res =>
          Number(res.slice(0, 50)),
        ),
      ]),
    ),
  );
}
