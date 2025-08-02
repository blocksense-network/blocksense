import { Effect, pipe, Schedule } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest';
import { deepStrictEqual } from 'assert';

import { getProcessComposeLogsFiles } from '@blocksense/base-utils/env';
import {
  entriesOf,
  fromEntries,
  mapValues,
  valuesOf,
} from '@blocksense/base-utils/array-iter';
import type { SequencerConfigV2 } from '@blocksense/config-types/node-config';
import type { NewFeedsConfig } from '@blocksense/config-types/data-feeds-config';

import { rgSearchPattern, parseProcessesStatus } from './helpers';
import { expectedPCStatuses03 } from './expected';
import type { ProcessComposeService, UpdatesToNetwork } from './types';
import { ProcessCompose, Sequencer } from './types';
import type { FeedsValueAndRound } from '../utils/onchain';
import { getDataFeedsInfoFromNetwork } from '../utils/onchain';

describe.sequential('E2E Tests with process-compose', () => {
  const network = 'ink_sepolia';
  const MAX_HISTORY_ELEMENTS_PER_FEED = 8192;

  let sequencerConfig: SequencerConfigV2;
  let feedsConfig: NewFeedsConfig;
  let feedIds: Array<bigint>;
  let processCompose: ProcessComposeService;
  let updatesToNetworks = {} as UpdatesToNetwork;

  let contractAddress: `0x${string}`;
  let initialFeedsInfo: FeedsValueAndRound;

  beforeAll(() =>
    pipe(
      ProcessCompose,
      Effect.provide(ProcessCompose.Live),
      Effect.tap(pc => pc.start('example-setup-03')),
      Effect.tap(pc => (processCompose = pc)),
      Effect.runPromise,
    ),
  );

  afterAll(() => pipe(processCompose.stop(), Effect.runPromise));

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
          times: 30,
        },
      );
      // still validate the result
      expect(equal).toBeTruthy();
    }).pipe(Effect.provide(ProcessCompose.Live)),
  );

  it.live('Test sequencer configs are available and in correct format', () =>
    Effect.gen(function* () {
      const sequencer = yield* Sequencer;
      sequencerConfig = yield* sequencer.getConfig();
      feedsConfig = yield* sequencer.getFeedsConfig();

      expect(sequencerConfig).toBeTypeOf('object');
      expect(feedsConfig).toBeTypeOf('object');
    }).pipe(
      Effect.provide(Sequencer.Live),
      // Once we have the sequencer config, we can get info about feeds
      Effect.tap(() =>
        Effect.gen(function* () {
          contractAddress = sequencerConfig.providers[network].contracts.find(
            c => c.name === 'AggregatedDataFeedStore',
          )!.address as `0x${string}`;
          const allow_feeds = sequencerConfig.providers[network].allow_feeds;

          feedIds = allow_feeds?.length
            ? (allow_feeds as Array<bigint>)
            : feedsConfig.feeds.map(feed => feed.id);
          // Get feeds information from the original network. No affection of the work of the
          // local sequencer.
          initialFeedsInfo = yield* getDataFeedsInfoFromNetwork(
            feedIds,
            contractAddress,
            'ink-sepolia',
          );
        }),
      ),
    ),
  );

  it.live(
    'Test processes state after at least 2 updates of each feeds have been made',
    () =>
      Effect.gen(function* () {
        const sequencer = yield* Sequencer;
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
      }).pipe(Effect.provide(Sequencer.Live)),
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

      // Get feeds information from the local network ( anvil )
      // Info is fetched for specific round - the initial round of the feed
      // + number of updates that happened while the local sequencer was running
      // modulo the maximum number of history elements per feed
      const currentFeedsInfo = yield* getDataFeedsInfoFromNetwork(
        feedIds,
        contractAddress,
        url,
        mapValues(
          initialRounds,
          (feedId, round) =>
            (round + updatesToNetworks[network][feedId]) %
            MAX_HISTORY_ELEMENTS_PER_FEED,
        ),
      );

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
      }
    }).pipe(Effect.provide(Sequencer.Live)),
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
