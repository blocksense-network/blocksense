import { Effect, Exit, Layer, pipe, Schedule } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest';
import { deepStrictEqual } from 'assert';

import {
  entriesOf,
  fromEntries,
  keysOf,
  mapValues,
  valuesOf,
} from '@blocksense/base-utils/array-iter';
import { getProcessComposeLogsFiles } from '@blocksense/base-utils/env';
import {
  parseEthereumAddress,
  type EthereumAddress,
} from '@blocksense/base-utils/evm';
import type { SequencerConfigV2 } from '@blocksense/config-types/node-config';
import type { NewFeedsConfig } from '@blocksense/config-types/data-feeds-config';

import { parseProcessesStatus, rgSearchPattern } from '../../utils/utilities';
import { expectedPCStatuses03 } from './expected-service-status';
import type {
  UpdatesToNetwork,
  ReportData,
  EnvironmentManagerService,
} from '../../utils/types';
import { EnvironmentManager } from '../../utils/types';
import type { FeedResult } from '../../utils/generate-signature';
import type { FeedsValueAndRound } from '../../utils/onchain';
import { getDataFeedsInfoFromNetwork } from '../../utils/onchain';
import { ProcessComposeLive } from '../../utils/environment-managers/process-compose-manager';
import { Sequencer } from '../../utils/sequencer';
import type { SequencerService } from '../../utils/sequencer';

describe.sequential('E2E Tests with process-compose', () => {
  const network = 'ink_sepolia';
  const MAX_HISTORY_ELEMENTS_PER_FEED = 8192;

  let sequencer: SequencerService;
  let processCompose: EnvironmentManagerService;
  let hasProcessComposeStarted = false;

  let sequencerConfig: SequencerConfigV2;
  let feedsConfig: NewFeedsConfig;

  let feedIds: bigint[];
  let contractAddress: EthereumAddress;

  let updatesToNetworks = {} as UpdatesToNetwork;
  let initialFeedsInfo: FeedsValueAndRound;

  beforeAll(async () => {
    const testEnvironment = 'example-setup-03';

    const res = await pipe(
      Effect.gen(function* () {
        processCompose = yield* EnvironmentManager;
        yield* processCompose.start(testEnvironment);
        hasProcessComposeStarted = true;

        if (!process.listenerCount('SIGINT')) {
          process.once('SIGINT', () => {
            if (hasProcessComposeStarted) {
              Effect.runPromise(
                processCompose
                  .stop()
                  .pipe(Effect.catchAll(() => Effect.succeed(undefined))),
              ).finally(() => {
                process.exit(130);
              });
            } else {
              process.exit(130);
            }
          });
        }

        sequencer = yield* Sequencer;
      }),
      Effect.provide(Layer.merge(ProcessComposeLive, Sequencer.Live)),
      Effect.runPromiseExit,
    );

    if (Exit.isFailure(res)) {
      throw new Error(`Failed to start test environment: ${testEnvironment}`);
    }
  });

  afterAll(() => {
    if (hasProcessComposeStarted) {
      return pipe(processCompose.stop(), Effect.runPromise);
    }
  });

  it.live('Test processes state shortly after start', () =>
    Effect.gen(function* () {
      const equal = yield* Effect.retry(
        processCompose
          .getProcessesStatus()
          .pipe(
            Effect.tap(processes =>
              Effect.try(() =>
                deepStrictEqual(processes, expectedPCStatuses03),
              ),
            ),
          ),
        {
          schedule: Schedule.fixed(1000),
          times: 90,
        },
      );
      // still validate the result
      expect(equal).toBeTruthy();
    }).pipe(Effect.provide(ProcessComposeLive)),
  );

  it.live('Test sequencer configs are available and in correct format', () =>
    Effect.gen(function* () {
      sequencerConfig = yield* sequencer.getConfig();
      feedsConfig = yield* sequencer.getFeedsConfig();
      expect(sequencerConfig).toBeTypeOf('object');
      expect(feedsConfig).toBeTypeOf('object');

      contractAddress = parseEthereumAddress(
        sequencerConfig.providers[network].contracts.find(
          c => c.name === 'AggregatedDataFeedStore',
        )?.address,
      );

      const allow_feeds = sequencerConfig.providers[network].allow_feeds;
      feedIds = allow_feeds?.length
        ? (allow_feeds as bigint[])
        : feedsConfig.feeds.map(feed => feed.id);
    }).pipe(
      Effect.tap(
        Effect.gen(function* () {
          const url = sequencerConfig.providers[network].url;

          // Fetch the initial round data for the feeds from the local network ( anvil )
          initialFeedsInfo = yield* getDataFeedsInfoFromNetwork(
            feedIds,
            contractAddress,
            url,
          );

          // Enable the provider which is disabled by default ( ink_sepolia )
          yield* sequencer.enableProvider(network);
        }),
      ),
    ),
  );

  it.live(
    'Test processes state after at least 2 updates of each feeds have been made',
    () =>
      Effect.gen(function* () {
        updatesToNetworks = yield* Effect.retry(
          sequencer
            .fetchUpdatesToNetworksMetric()
            .pipe(
              Effect.filterOrFail(updates =>
                valuesOf(updates[network]).every(v => v > 2),
              ),
            ),
          {
            schedule: Schedule.fixed(10000),
            times: 30,
          },
        );

        const processes = yield* parseProcessesStatus();

        expect(processes).toEqual(expectedPCStatuses03);
      }),
  );

  it.live('Test feeds data is updated on the local network', () =>
    Effect.gen(function* () {
      const url = sequencerConfig.providers[network].url;

      // Save map of initial rounds for each feed
      const initialRounds = fromEntries(
        entriesOf(initialFeedsInfo).map(([id, data]) => [id, data.round]),
      );

      // Get feeds information from the local network ( anvil )
      // for the same round as the initial one, to confirm it is not being overwritten
      const initialFeedsInfoLocal = yield* getDataFeedsInfoFromNetwork(
        feedIds,
        contractAddress,
        url,
        initialRounds,
      );

      expect(initialFeedsInfo).toEqual(initialFeedsInfoLocal);

      // If some feeds were not updated, we will log a warning
      // and continue with the available feeds
      const updatedFeedIds = keysOf(updatesToNetworks[network]).map(feedId =>
        BigInt(feedId),
      );
      if (updatedFeedIds.length !== feedIds.length) {
        yield* Effect.logWarning('Not all feeds have been updated');
        const missingFeeds = feedIds.filter(
          feedId => !updatedFeedIds.includes(feedId),
        );
        yield* Effect.logWarning('Missing updates for feeds:', missingFeeds);
        yield* Effect.logWarning('Test will continue with available feeds');

        // Remove missing feeds from the initial rounds info
        for (const feedId of missingFeeds) {
          delete initialRounds[feedId.toString()];
        }
      }

      // Get feeds information from the local network ( anvil )
      // Info is fetched for specific round - the initial round of the feed
      // + number of updates that happened while the local sequencer was running
      // modulo the maximum number of history elements per feed
      const feedInfoAfterUpdates = yield* getDataFeedsInfoFromNetwork(
        updatedFeedIds,
        contractAddress,
        url,
        mapValues(
          initialRounds,
          (feedId, round) =>
            (round + updatesToNetworks[network][feedId]) %
            MAX_HISTORY_ELEMENTS_PER_FEED,
        ),
      );

      const feedAggregateHistory = yield* sequencer.fetchHistory();

      // Make sure that the feeds info is updated
      for (const [id, data] of entriesOf(feedInfoAfterUpdates)) {
        const { round: roundAfterUpdates, value: valueAfterUpdates } = data;
        // Pegged asset with 10% tolerance should be pegged
        // Pegged asset with 0.000001% tolerance should not be pegged
        if (id === '50000') {
          expect(valueAfterUpdates).toEqual(1 * 10 ** 8);
          continue;
        }
        expect(valueAfterUpdates).not.toEqual(initialFeedsInfo[id].value);

        const historyData = feedAggregateHistory.aggregate_history[id].find(
          // In history data, the indexing of updates starts from 0.
          // Hence, we need to subtract 1 from the number of updates
          feed => feed.update_number === updatesToNetworks[network][id] - 1,
        );
        const decimals = feedsConfig.feeds.find(f => f.id.toString() === id)!
          .additional_feed_info.decimals;

        expect(valueAfterUpdates / 10 ** decimals).toBeCloseTo(
          historyData!.value.Numerical,
        );

        const expectedNumberOfUpdates =
          (MAX_HISTORY_ELEMENTS_PER_FEED +
            (roundAfterUpdates - initialFeedsInfo[id].round)) %
          MAX_HISTORY_ELEMENTS_PER_FEED;

        expect(expectedNumberOfUpdates).toEqual(updatesToNetworks[network][id]);
      }
    }),
  );

  describe.sequential('Reports results are correctly updated', () => {
    it.live('Posts reports and observes a network update', () =>
      Effect.gen(function* () {
        const feed_id = feedIds[0].toString();

        const numericalResult: FeedResult = { Ok: { Numerical: 3.14159 } }; // Ok → Numerical
        const textResult: FeedResult = { Ok: { Text: 'sensor online' } }; // Ok → Text
        const bytesResult: FeedResult = {
          Ok: { Bytes: [72, 101, 108, 108, 111] },
        }; // Ok → Bytes
        const apiErrorResult: FeedResult = {
          Err: { APIError: 'Rate limit exceeded' },
        }; // Err → APIError
        const undefinedErrorResult: FeedResult = {
          Err: { UndefinedError: {} },
        }; // Err → UndefinedError

        const reports: ReportData[] = [
          { feed_id, value: numericalResult },
          { feed_id, value: textResult },
          { feed_id, value: bytesResult },
          { feed_id, value: apiErrorResult },
          { feed_id, value: undefinedErrorResult },
        ];

        const baselineUpdates = yield* sequencer
          .fetchUpdatesToNetworksMetric()
          .pipe(Effect.map(m => m[network]?.[feed_id] ?? 0));

        for (const report of reports) {
          const response = yield* sequencer.postReportsBatch([report]);
          expect(response.status).toEqual(200);
        }

        const finalCount = yield* Effect.retry(
          sequencer.fetchUpdatesToNetworksMetric().pipe(
            Effect.map(m => m[network]?.[feed_id] ?? 0),
            Effect.filterOrFail(count => count >= baselineUpdates + 1),
          ),
          { schedule: Schedule.fixed(2000), times: 30 },
        );

        expect(finalCount).toBeGreaterThanOrEqual(baselineUpdates + 1);
      }),
    );
  });

  describe.sequential('Reporter behavior based on logs', () => {
    const reporterLogsFile =
      getProcessComposeLogsFiles('example-setup-03')['reporter-a'];

    it.live('Reporter should NOT panic', () =>
      Effect.gen(function* () {
        const result = yield* rgSearchPattern({
          file: reporterLogsFile,
          pattern: 'panic',
          caseInsensitive: true,
        });

        expect(result).toBeFalsy();
      }),
    );

    it.live('Reporter should NOT receive errors from Sequencer', () =>
      Effect.gen(function* () {
        const result = yield* rgSearchPattern({
          file: reporterLogsFile,
          pattern: 'Sequencer responded with status=(?!200)\\d+',
          flags: ['--pcre2'],
        });

        expect(result).toBeFalsy();
      }),
    );
  });
});
