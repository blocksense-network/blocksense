import { deepStrictEqual } from 'assert';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { loopWhile, sleep } from '@blocksense/base-utils/async';

import {
  parseProcessesStatus,
  startEnvironment,
  stopEnvironment,
} from './utils/process-compose';

import { expectedPCStatuses03 } from './expected';
import { execa } from 'execa';
import { getProcessComposeLogsFiles } from '@blocksense/base-utils/env';

describe.sequential('E2E Tests with process-compose', async () => {
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

  test('Test processes state after 2 mins', async () => {
    // TODO: (EmilIvanichkovv): Consider reading `the total_tx_sent` metrics from the sequencer instead of wait for something unspecified to happen.
    // Wait for the processes to work for 5 minutes
    await sleep(2 * 60 * 1000);

    // Get the processes status
    const processes = await parseProcessesStatus();

    expect(processes).toEqual(expectedPCStatuses03);
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
