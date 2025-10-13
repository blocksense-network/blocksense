import { Effect } from 'effect';

import type { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import { AggregatedDataFeedStoreConsumer } from '@blocksense/contracts/viem';

export type FeedsValueAndRound = Record<
  string,
  { value: number; round: number }
>;

/**
 * Fetches data feed values and their corresponding round numbers from the blockchain.
 *
 * If `roundsInfo` is provided, it fetches data at the specified round for each feed ID.
 * Otherwise, it fetches the latest data and round index for each feed.
 *
 * @param {Array<bigint>} feedIds - List of feed IDs to query.
 * @param {EthereumAddress} contractAddress - Address of the AggregatedDataFeedStore contract.
 * @param {NetworkName | string} provider - Either a known network name or an RPC URL.
 * @param {Record<string, number>} [roundsInfo] - Optional map of feed IDs to specific round numbers.
 */
export function getDataFeedsInfoFromNetwork(
  feedIds: bigint[],
  contractAddress: EthereumAddress,
  provider: NetworkName | URL,
  roundsInfo?: Record<string, number>,
): Effect.Effect<FeedsValueAndRound, Error, never> {
  return Effect.gen(function* () {
    const ADFSConsumer = AggregatedDataFeedStoreConsumer.create(
      contractAddress,
      provider,
    );

    const feedsInfo: FeedsValueAndRound = {};
    for (const feedId of feedIds) {
      const data = yield* Effect.tryPromise(() =>
        // If round is provided, fetch data at that specific round
        // Otherwise, fetch the latest data and index
        roundsInfo !== undefined
          ? ADFSConsumer.getSingleDataAtIndex(
              feedId,
              roundsInfo[feedId.toString()],
            ).then(res => ({
              data: res,
              index: roundsInfo[feedId.toString()],
            }))
          : ADFSConsumer.getLatestSingleDataAndIndex(BigInt(feedId)),
      ).pipe(
        Effect.mapError(
          error =>
            new Error(`Failed to fetch data for feed ${feedId}: ${error}`),
        ),
      );
      feedsInfo[feedId.toString()] = {
        value: Number(data.data.slice(0, 50)),
        round: Number(data.index),
      };
    }
    return feedsInfo;
  });
}
