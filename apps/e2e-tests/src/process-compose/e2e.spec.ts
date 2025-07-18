import { deepStrictEqual } from 'assert';
import { execa } from 'execa';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { loopWhile, sleep } from '@blocksense/base-utils/async';
import { getProcessComposeLogsFiles } from '@blocksense/base-utils/env';
import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { entriesOf, mapValuePromises } from '@blocksense/base-utils';
import { AggregatedDataFeedStoreConsumer } from '@blocksense/contracts/viem';
import type { SequencerConfigV2 } from '@blocksense/config-types/node-config';
import { SequencerConfigV2Schema } from '@blocksense/config-types/node-config';

import {
  parseProcessesStatus,
  startEnvironment,
  stopEnvironment,
} from './helpers';
import { expectedPCStatuses03 } from './expected';

describe.sequential('E2E Tests with process-compose', async () => {
  const sequencerConfigUrl = 'http://127.0.0.1:5553/get_sequencer_config';
  const network = 'ink_sepolia';

  let sequencerConfig: SequencerConfigV2;
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
      SequencerConfigV2Schema,
      sequencerConfigUrl,
    );

    expect(sequencerConfig).toBeTypeOf('object');

    // Collect initial information for the feeds and their prices
    const url = sequencerConfig.providers[network].url;
    const contractAddress = sequencerConfig.providers[network]
      .contract_address as `0x${string}`;
    allowFeeds =
      sequencerConfig?.providers?.[network]?.allow_feeds?.map(feedId =>
        BigInt(feedId),
      ) ?? [];

    ADFSConsumer = AggregatedDataFeedStoreConsumer.createConsumerByRpcUrl(
      contractAddress,
      url,
    );

    initialPrices = allowFeeds.reduce(
      (acc, feedId) => {
        acc[feedId.toString()] = 0;
        return acc;
      },
      {} as Record<string, number>,
    );
    initialPrices = await mapValuePromises(
      initialPrices,
      async (feedId, _) =>
        await ADFSConsumer.getLatestSingleData(feedId).then(res =>
          Number(res.slice(0, 50)),
        ),
    );
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
    const currentPrices = await mapValuePromises(
      initialPrices,
      async (feedId, _) =>
        await ADFSConsumer.getLatestSingleData(feedId).then(res =>
          Number(res.slice(0, 50)),
        ),
    );

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
