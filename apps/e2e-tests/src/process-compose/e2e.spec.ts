import { Effect, pipe } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest';
import { deepStrictEqual } from 'assert';

import { loopWhile } from '@blocksense/base-utils/async';
import { getProcessComposeLogsFiles } from '@blocksense/base-utils/env';
import { entriesOf, mapValuePromises, valuesOf } from '@blocksense/base-utils';
import { AggregatedDataFeedStoreConsumer } from '@blocksense/contracts/viem';

import { fetchUpdatesToNetworksMetric, parseProcessesStatus } from './helpers';
import { expectedPCStatuses03 } from './expected';
import type { ProcessComposeService, UpdatesToNetwork } from './types';
import {
  RGLogChecker,
  RGLogCheckerLive,
  ProcessCompose,
  ProcessComposeLive,
  Sequencer,
  SequencerLive,
} from './types';

describe.sequential('E2E Tests with process-compose', () => {
  const network = 'ink_sepolia';

  let feedIds: Array<bigint>;
  let processCompose: ProcessComposeService;
  let ADFSConsumer;
  let initialPrices: Record<string, number>;

  beforeAll(() =>
    pipe(
      ProcessCompose,
      Effect.provide(ProcessComposeLive),
      Effect.tap(pc => pc.start('example-setup-03')),
      Effect.tap(pc => (processCompose = pc)),
      Effect.runPromise,
    ),
  );

  afterAll(() => pipe(processCompose.stop(), Effect.runPromise));

  it.effect('Test processes state shortly after start', () =>
    Effect.gen(function* () {
      const equal = yield* Effect.promise(() =>
        loopWhile(
          (equal: boolean) => !equal,
          async () => {
            try {
              const processes = await parseProcessesStatus();
              deepStrictEqual(processes, expectedPCStatuses03);
              return true;
            } catch {
              return false;
            }
          },
          1000,
          10,
        ),
      );

      expect(equal).toBeTruthy();
    }),
  );

  it.effect('Test sequencer config is available and in correct format', () =>
    Effect.gen(function* () {
      const sequencer = yield* Sequencer;
      const sequencerConfig = yield* sequencer.getConfig();

      expect(sequencerConfig).toBeTypeOf('object');
      return sequencerConfig;
    }).pipe(
      Effect.tap(config =>
        Effect.gen(function* () {
          // Collect initial information for the feeds and their prices
          const url = config.providers[network].url;
          const contractAddress = config.providers[network]
            .contract_address as `0x${string}`;
          const allow_feeds = config.providers[network].allow_feeds;

          const sequencer = yield* Sequencer;
          const feedsConfig = yield* sequencer.getFeedsConfig();

          feedIds = allow_feeds?.length
            ? (allow_feeds as Array<bigint>)
            : feedsConfig.feeds.map(feed => feed.id);

          ADFSConsumer = yield* Effect.sync(() =>
            AggregatedDataFeedStoreConsumer.createConsumerByRpcUrl(
              contractAddress,
              url,
            ),
          );

          initialPrices = feedIds.reduce(
            (acc, feedId) => {
              acc[feedId.toString()] = 0;
              return acc;
            },
            {} as Record<string, number>,
          );

          initialPrices = yield* Effect.promise(() =>
            mapValuePromises(
              initialPrices,
              async (feedId, _) =>
                await ADFSConsumer.getLatestSingleData(feedId).then(res =>
                  Number(res.slice(0, 50)),
                ),
            ),
          );
        }),
      ),
      Effect.provide(SequencerLive),
    ),
  );

  it.effect(
    'Test processes state after at least 2 updates of each feeds have been made',
    () =>
      Effect.gen(function* () {
        const _updates = yield* Effect.promise(() =>
          loopWhile(
            (updates: UpdatesToNetwork | null) =>
              updates === null || !valuesOf(updates[network]).every(v => v > 2),
            () => {
              return Effect.runPromise(fetchUpdatesToNetworksMetric());
            },
            10000,
            30,
          ),
        );

        const processes = yield* Effect.tryPromise(() =>
          parseProcessesStatus(),
        );

        expect(processes).toEqual(expectedPCStatuses03);
      }),
  );

  it.effect('Test prices are updated', () =>
    Effect.gen(function* () {
      const currentPrices = yield* Effect.promise(() =>
        mapValuePromises(
          initialPrices,
          async (feedId, _) =>
            await ADFSConsumer.getLatestSingleData(feedId).then(res =>
              Number(res.slice(0, 50)),
            ),
        ),
      );

      for (const [id, price] of entriesOf(currentPrices)) {
        // Pegged asset with 10% tolerance should be pegged
        // Pegged asset with 0.000001% tolerance should not be pegged
        if (id === '50000') {
          expect(price).toEqual(1 * 10 ** 8);
          continue;
        }
        expect(price).not.toEqual(initialPrices[id]);
      }
    }),
  );

  describe.sequential('Reporter behavior based on logs', () => {
    const reporterLogsFile =
      getProcessComposeLogsFiles('example-setup-03')['reporter-a'];

    it.effect('Reporter should NOT panic', () =>
      Effect.gen(function* () {
        const rgLogChecker = yield* RGLogChecker;
        const result = yield* rgLogChecker.assertDoesNotContain({
          file: reporterLogsFile,
          pattern: 'panic',
          caseInsensitive: true,
        });

        expect(result).toBe(1);
      }).pipe(Effect.provide(RGLogCheckerLive)),
    );

    it.effect('Reporter should NOT receive errors from Sequencer', () =>
      Effect.gen(function* () {
        const rgLogChecker = yield* RGLogChecker;
        const result = yield* rgLogChecker.assertDoesNotContain({
          file: reporterLogsFile,
          pattern: 'Sequencer responded with status=(?!200)\\d+',
          flags: ['--pcre2'],
        });

        expect(result).toBe(1);
      }).pipe(Effect.provide(RGLogCheckerLive)),
    );
  });
});
