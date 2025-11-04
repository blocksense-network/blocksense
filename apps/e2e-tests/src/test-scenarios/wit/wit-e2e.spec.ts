import { deepStrictEqual } from 'assert';
import { join } from 'path';

import { Effect, Exit, Layer, pipe, Schedule } from 'effect';
import { Command, FileSystem } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest';

import { rootDir } from '@blocksense/base-utils';
import {
  entriesOf,
  fromEntries,
  valuesOf,
} from '@blocksense/base-utils/array-iter';
import {
  type EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import type { NewFeedsConfig } from '@blocksense/config-types/data-feeds-config';
import type { SequencerConfigV2 } from '@blocksense/config-types/node-config';

import {
  parseProcessesStatus,
  ProcessComposeLive,
} from '../../utils/environment-managers/process-compose-manager';
import type { EnvironmentManagerService } from '../../utils/environment-managers/types';
import { EnvironmentManager } from '../../utils/environment-managers/types';
import {
  createGatewayController,
  gateEffect,
  installGateway,
} from '../../utils/services/gateway';
import type { FeedsValueAndRound } from '../../utils/services/onchain';
import { getDataFeedsInfoFromNetwork } from '../../utils/services/onchain';
import type { SequencerService } from '../../utils/services/sequencer';
import { Sequencer } from '../../utils/services/sequencer';

import { expectedPCStatuses03 } from './expected-service-status';
import { createViemClient } from '@blocksense/contracts/viem';

import viem from 'viem';

describe.sequential('E2E Tests with process-compose', () => {
  const testScenario = `wit`;
  const testEnvironment = `e2e-${testScenario}`;
  const network = 'ink_sepolia';

  const failFastGateway = createGatewayController();
  installGateway(
    failFastGateway,
    'Skipping remaining tests because the gate test failed',
  );

  let sequencer: SequencerService;
  let processCompose: EnvironmentManagerService;
  let hasProcessComposeStarted = false;

  let sequencerConfig: SequencerConfigV2;
  let feedsConfig: NewFeedsConfig;

  let feedIds: bigint[];
  let contractAddress: EthereumAddress;

  let initialFeedsInfo: FeedsValueAndRound;

  let existingFiles: string[] = [];

  const deleteTestFiles = () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const allFiles = yield* fs.readDirectory(__dirname);
      const newFiles = allFiles.filter(file => !existingFiles.includes(file));
      if (newFiles.length > 0) {
        console.log(
          `Cleaning up ${newFiles.length} files created during tests:`,
        );
        for (const file of newFiles) {
          console.log(` - ${file}`);
          yield* fs.remove(join(__dirname, file), {
            force: true,
            recursive: true,
          });
        }
      }
    });

  beforeAll(async () => {
    // track files created during the tests
    existingFiles = await Effect.runPromise(
      FileSystem.FileSystem.pipe(
        Effect.flatMap(fs => fs.readDirectory(__dirname)),
        Effect.provide(NodeContext.layer),
      ),
    );

    const res = await pipe(
      Effect.gen(function* () {
        processCompose = yield* EnvironmentManager;
        yield* processCompose.start(testScenario);
        hasProcessComposeStarted = true;

        if (!process.listenerCount('SIGINT')) {
          process.once('SIGINT', () => {
            if (hasProcessComposeStarted) {
              Effect.runPromise(
                processCompose
                  .stop()
                  .pipe(Effect.catchAll(() => Effect.succeed(undefined)))
                  .pipe(() =>
                    deleteTestFiles().pipe(Effect.provide(NodeContext.layer)),
                  ),
              ).finally(async () => {
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

  afterAll(() =>
    Effect.gen(function* () {
      if (hasProcessComposeStarted) {
        yield* processCompose.stop();
      }

      yield* deleteTestFiles();
    })
      .pipe(Effect.provide(NodeContext.layer))
      .pipe(Effect.runPromise),
  );

  it.live('Test processes state shortly after start', () =>
    gateEffect(
      failFastGateway,
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
      'Gate test failed: processes are not in expected state',
    ),
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
        : feedsConfig.feeds.map(feed => {
            const stride = BigInt(feed.stride) << 120n;
            return stride | feed.id;
          });
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

  it.live('Test sports db yields metrics', () =>
    Effect.gen(function* () {
      yield* Effect.retry(
        sequencer.fetchUpdatesToNetworksMetric().pipe(
          Effect.filterOrFail(updates =>
            // TODO: how to look for stride too?
            valuesOf(updates[network]).every(v => v >= 1),
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

      for (const feedId of feedIds) {
        const value = initialFeedsInfo[feedId.toString()].value;
        const stride = feedId >> 120n;

        expect(BigInt((value.length - 2) / 2 / 32)).toEqual(2n ** stride);

        yield* Command.make(
          'just',
          'dev',
          'decoder',
          'generate-decoder',
          '--wit-path',
          'apps/e2e-tests/src/test-scenarios/wit/sports.wit',
          '--output-dir',
          'apps/e2e-tests/src/test-scenarios/wit/generated-decoders',
          '--stride',
          stride.toString(),
        ).pipe(Command.string, Effect.provide(NodeContext.layer));

        yield* Command.make(
          'forge',
          'build',
          '--root',
          rootDir + '/apps/e2e-tests/src/test-scenarios/wit',
          'generated-decoders',
        ).pipe(Command.string, Effect.provide(NodeContext.layer));

        const contracts = yield* FileSystem.FileSystem.pipe(
          Effect.flatMap(fs =>
            fs
              .readDirectory(__dirname + '/generated-decoders')
              .pipe(Effect.map(files => files.map(file => file))),
          ),
          Effect.provide(NodeContext.layer),
        );

        expect(contracts.length).toBeGreaterThan(0);

        for (const contractFile of contracts) {
          const deployResult = yield* Command.make(
            'forge',
            'create',
            '--rpc-url',
            'http://localhost:8500',
            // sequencerConfig.providers[network].url,
            // 1st account private key from anvil
            '--private-key',
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            '--root',
            rootDir + '/apps/e2e-tests/src/test-scenarios/wit',
            `generated-decoders/${contractFile}:${contractFile.replace('.sol', '')}`,
            '--broadcast',
          ).pipe(Command.string, Effect.provide(NodeContext.layer));

          // Extract contract address from the deploy result
          const contractAddressMatch = deployResult.match(
            /Deployed to:\s*(0x[a-fA-F0-9]{40})/,
          );
          if (!contractAddressMatch) {
            throw new Error(
              'Failed to extract contract address from deploy result',
            );
          }

          const contractAddress = contractAddressMatch[1];
          expect(contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

          const codeResult = yield* Command.make(
            'cast',
            'code',
            '--rpc-url',
            'http://localhost:8500',
            contractAddress,
          ).pipe(Command.string, Effect.provide(NodeContext.layer));

          expect(codeResult).not.toEqual('0x');
          expect(codeResult.length).toBeGreaterThan(10);

          const abi = yield* Command.make(
            'forge',
            'inspect',
            '--root',
            rootDir + '/apps/e2e-tests/src/test-scenarios/wit',
            'generated-decoders/SSZDecoder.sol',
            'abi',
            '--json',
          )
            .pipe(Command.string, Effect.provide(NodeContext.layer))
            .pipe(Effect.map(JSON.parse));

          const viemClient = createViemClient(new URL('http://localhost:8500'));

          const decoded = (yield* Effect.tryPromise(() =>
            viemClient.readContract({
              address: contractAddress as EthereumAddress,
              abi,
              functionName: 'decode',
              args: [value],
            }),
          )) as {
            eventName: string;
            season: string;
            homeTeam: string;
            awayTeam: string;
            homeScore: bigint;
            awayScore: bigint;
          };

          const eventId = yield* Effect.tryPromise({
            try: () =>
              fetch(
                'https://www.thesportsdb.com/api/v1/json/123/eventslast.php?id=133602',
                {
                  method: 'GET',
                },
              ).then(res =>
                res.json().then(data => data.results[0].idEvent as string),
              ),
            catch: () => {
              throw new Error('Failed to fetch data from TheSportsDB API');
            },
          });

          const event = yield* Effect.tryPromise({
            try: () =>
              fetch(
                `https://www.thesportsdb.com/api/v1/json/123/lookupevent.php?id=${eventId}`,
                {
                  method: 'GET',
                },
              ).then(res =>
                res.json().then(data => {
                  return {
                    name: data.events[0].strEvent,
                    season: data.events[0].strSeason,
                    homeTeam: data.events[0].strHomeTeam,
                    awayTeam: data.events[0].strAwayTeam,
                    homeScore: data.events[0].intHomeScore,
                    awayScore: data.events[0].intAwayScore,
                  };
                }),
              ),
            catch: () => {
              throw new Error('Failed to fetch data from TheSportsDB API');
            },
          });

          expect(decoded.eventName).toEqual(event.name);
          expect(decoded.season).toEqual(event.season);
          expect(decoded.homeTeam).toEqual(event.homeTeam);
          expect(decoded.awayTeam).toEqual(event.awayTeam);
          expect(BigInt(decoded.homeScore)).toEqual(BigInt(event.homeScore));
          expect(BigInt(decoded.awayScore)).toEqual(BigInt(event.awayScore));
        }
      }
    }),
  );
});
