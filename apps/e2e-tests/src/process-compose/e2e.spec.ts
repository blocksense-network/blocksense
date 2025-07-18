import { deepStrictEqual } from 'assert';
import { execa } from 'execa';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { Schema as S } from 'effect';

import { loopWhile, sleep } from '@blocksense/base-utils/async';
import { getProcessComposeLogsFiles } from '@blocksense/base-utils/env';
import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { AggregatedDataFeedStoreConsumer } from '@blocksense/contracts/viem';

import {
  parseProcessesStatus,
  startEnvironment,
  stopEnvironment,
} from './helpers';
import { expectedPCStatuses03 } from './expected';
import { getPricesInfo } from '../utils/onchain-data';
import { entriesOf } from '@blocksense/base-utils';

//TODO:(milagenova): Update once [PR:1457] is merged
const SequencerSchema = S.Struct({
  providers: S.Record({
    key: S.String,
    value: S.Struct({
      url: S.String,
      contract_address: S.String,
      allow_feeds: S.Array(S.Number),
    }),
  }),
});

describe.sequential('E2E Tests with process-compose', async () => {
  const sequencerConfigUrl = 'http://127.0.0.1:5553/get_sequencer_config';
  const network = 'ink_sepolia';

  let sequencerConfig: typeof SequencerSchema.Type;
  let ADFSConsumer;
  let allowFeeds: Array<bigint>;
  let initialPrices: Record<string, number>;

  beforeAll(async () => {
    await startEnvironment('example-setup-03');
  });

  afterAll(async () => {
    await stopEnvironment();
  });

  test('Test processes state shortly after start', async () => {
    const equal = await loopWhile(
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
    );
    expect(equal).toBe(true);
  });

  test('Test sequencer config is available and in correct format', async () => {
    sequencerConfig = await fetchAndDecodeJSON(
      SequencerSchema,
      sequencerConfigUrl,
    );

    expect(sequencerConfig).toBeTypeOf('object');

    // Collect initial information for the feeds and their prices
    const url = sequencerConfig.providers[network].url;
    const contractAddress = sequencerConfig.providers[network]
      .contract_address as `0x${string}`;
    allowFeeds = sequencerConfig.providers[network].allow_feeds.map(feedId =>
      BigInt(feedId),
    );

    ADFSConsumer = AggregatedDataFeedStoreConsumer.createConsumerByRpcUrl(
      contractAddress,
      url,
    );

    initialPrices = await getPricesInfo(allowFeeds, ADFSConsumer);
  });

  test('Test processes state after 2 mins', async () => {
    // TODO: (EmilIvanichkovv): Consider reading `the total_tx_sent` metrics from the sequencer instead of wait for something unspecified to happen.
    // Wait for the processes to work for 5 minutes
    await sleep(2 * 60 * 1000);

    // Get the processes status
    const processes = await parseProcessesStatus();

    expect(processes).toEqual(expectedPCStatuses03);
  });

  test('Test prices are updated', async () => {
    const currentPrices = await getPricesInfo(allowFeeds, ADFSConsumer);

    for (const [id, price] of entriesOf(currentPrices)) {
      expect(price).not.toEqual(initialPrices[id]);
    }
  });

  describe.sequential('Reporter behavior based on logs', async () => {
    const reporterLogsFile =
      getProcessComposeLogsFiles('example-setup-03')['reporter-a'];

    test('Reporter should NOT panic', async () => {
      const result = await execa('rg', ['-i', 'panic', reporterLogsFile], {
        reject: false,
      });
      expect(result.exitCode).toBe(1);
    });

    test('Reporter should NOT receive errors from Sequencer', async () => {
      const result = await execa(
        'rg',
        [
          '-i',
          '--pcre2',
          'Sequencer responded with status=(?!200)\\d+',
          reporterLogsFile,
        ],
        {
          reject: false,
        },
      );

      expect(result.exitCode).toBe(1);
    });
  });
});
