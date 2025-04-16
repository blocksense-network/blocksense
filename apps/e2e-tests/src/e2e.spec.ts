import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { sleep } from '@blocksense/base-utils/async';

import {
  parseProcessesStatus,
  processComposeOrchestration,
} from './utils/process-compose';

describe.sequential('E2E Tests with process-compose', async () => {
  const expectedProcessesStatus = {
    'aggregate-consensus-reader': {
      status: 'Running',
      exit_code: 0,
    },
    'anvil-impersonate-and-fund-ethereum-sepolia': {
      status: 'Completed',
      exit_code: 0,
    },
    'anvil-impersonate-and-fund-ink-sepolia': {
      status: 'Completed',
      exit_code: 0,
    },
    'anvil-ethereum-sepolia': {
      status: 'Running',
      exit_code: 0,
    },
    'anvil-ink-sepolia': {
      status: 'Running',
      exit_code: 0,
    },
    'blockchain-reader': {
      status: 'Running',
      exit_code: 0,
    },
    'blocksense-reporter-a': {
      status: 'Running',
      exit_code: 0,
    },
    'blocksense-sequencer': {
      status: 'Running',
      exit_code: 0,
    },
    kafka: {
      status: 'Running',
      exit_code: 0,
    },
  };

  beforeAll(async () => {
    // Start the process-compose
    await processComposeOrchestration('start');
  });

  afterAll(async () => {
    // Stop the process-compose
    await processComposeOrchestration('stop');
  });

  test('Test processes state shortly after start', async () => {
    // Wait for the processes to be up and running
    await sleep(5000);

    // Get the processes status
    const processes = await parseProcessesStatus();

    expect(processes).toEqual(expectedProcessesStatus);
  });

  test('Test processes state after 5 mins', async () => {
    // Wait for the processes to work for 5 minutes
    await sleep(2 * 60 * 1000);

    // Get the processes status
    const processes = await parseProcessesStatus();

    expect(processes).toEqual(expectedProcessesStatus);
  });
});
