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

import {
  rgSearchPattern,
  parseProcessesStatus,
  getInitialFeedsInfoFromNetwork,
} from './helpers';
import { expectedPCStatuses03 } from './expected';
import type {
  ProcessComposeService,
  SequencerService,
  UpdatesToNetwork,
} from './types';
import { ProcessCompose, Sequencer } from './types';
import type { FeedsValueAndRound } from '../utils/onchain';
import { getDataFeedsInfoFromNetwork } from '../utils/onchain';

describe.sequential('E2E Tests with process-compose', () => {
  const network = 'ink_sepolia';
  const MAX_HISTORY_ELEMENTS_PER_FEED = 8192;

  let feedIdsFromConfig: Array<bigint>;
  let contractAddressFromConfig: EthereumAddress;

  let sequencer: SequencerService;
  let processCompose: ProcessComposeService;
  let hasProcessComposeStarted = false;

  let sequencerConfig: SequencerConfigV2;
  let feedsConfig: NewFeedsConfig;

  let feedIds: Array<bigint>;
  let contractAddress: EthereumAddress;

  let updatesToNetworks = {} as UpdatesToNetwork;
  let initialFeedsInfo: FeedsValueAndRound;

  beforeAll(async () => {
    const testEnvironment = 'example-setup-03';

    const res = await pipe(
      Effect.gen(function* () {
        processCompose = yield* ProcessCompose;
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

        // Get feeds information from the original network. No affection of the work of the
        // local sequencer.
        ({
          address: contractAddressFromConfig,
          feedIds: feedIdsFromConfig,
          initialFeedsInfo,
        } = yield* getInitialFeedsInfoFromNetwork('ink-sepolia'));
      }),
      Effect.provide(Layer.merge(ProcessCompose.Live, Sequencer.Live)),
      Effect.runPromiseExit,
    );

    if (Exit.isFailure(res)) {
      throw new Error(`Failed to start test environment: ${testEnvironment}`);
    }
  });

  beforeAll(() => {
    feedIds = feedIdsFromConfig;
    contractAddress = contractAddressFromConfig;
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
          .parseStatus()
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
    }).pipe(Effect.provide(ProcessCompose.Live)),
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

      expect(contractAddress).toEqual(contractAddressFromConfig);

      const allow_feeds = sequencerConfig.providers[network].allow_feeds;
      feedIds = allow_feeds?.length
        ? (allow_feeds as Array<bigint>)
        : feedsConfig.feeds.map(feed => feed.id);
      expect(feedIds).toEqual(feedIdsFromConfig);
    }),
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

        const processes = yield* Effect.tryPromise(() =>
          parseProcessesStatus(),
        );

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
      const currentFeedsInfo = yield* getDataFeedsInfoFromNetwork(
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

      const historyData = yield* sequencer.fetchHistory();

      // Make sure that the feeds info is updated
      for (const [id, data] of entriesOf(currentFeedsInfo)) {
        const { round, value } = data;
        expect(round).toBeGreaterThan(initialFeedsInfo[id].round);
        // Pegged asset with 10% tolerance should be pegged
        // Pegged asset with 0.000001% tolerance should not be pegged
        if (id === '50000') {
          expect(value).toEqual(1 * 10 ** 8);
          continue;
        }
        expect(value).not.toEqual(initialFeedsInfo[id].value);

        const actualData = historyData.aggregate_history[id].find(
          feed => feed.update_number === round - initialFeedsInfo[id].round - 1,
        );
        const decimals = feedsConfig.feeds.find(f => f.id.toString() === id)!
          .additional_feed_info.decimals;

        expect(value / 10 ** decimals).toBeCloseTo(actualData!.value.Numerical);
      }
    }),
  );

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
