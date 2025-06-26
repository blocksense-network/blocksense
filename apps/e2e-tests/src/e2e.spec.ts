import {
  afterAll,
  beforeAll,
  describe,
  expect,
  onTestFailed,
  test,
} from 'vitest';

import { sleep } from '@blocksense/base-utils/async';

import { logMessage } from './utils/logs';
import {
  parseProcessesStatus,
  processComposeOrchestration,
} from './utils/process-compose';
import { getLogsLines, parseLogs } from './utils/log-files';

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

  describe.sequential('Reporter behavior based on logs', async () => {
    let reporterLogs;
    test('Reporter should NOT panics', async () => {
      // TODO(EmilIvanichkovv): Think about this more.
      reporterLogs = await parseLogs('reporter-a');
      const panicLines = reporterLogs.filter(
        line =>
          line.content.includes('panicked') || line.content.includes('Panic'),
      );
      onTestFailed(_ => {
        logMessage(
          'error',
          'Reporter panicked! Tips:',
          'The failure of this test indicates that the reporter panicked. Please examine the logs of\n\n' +
            `${getLogsLines(panicLines, 'reporter-a')}`,
          150,
        );
      });
      expect(panicLines.length).toBe(0);
    });

    test('Reporter should NOT have ERROR traces', async () => {
      const errorLines = reporterLogs.filter(line =>
        line.content.includes('ERROR'),
      );

      onTestFailed(_ => {
        logMessage(
          'error',
          'Reporter encountered ERROR traces! Tips:',
          'The failure of this test indicates that the reporter encountered ERROR traces. Please examine the logs:\n\n' +
            `${getLogsLines(errorLines, 'reporter-a')}`,
          150,
        );
      });

      expect(errorLines.length).toBe(0);
    });

    test('Reporter should NOT receive errors from Sequencer', async () => {
      const sequencerResponseLines = reporterLogs.filter(line =>
        line.content.includes('Sequencer responded with status'),
      );

      // Check if all responses from the sequencer are 200
      const statusCodes = sequencerResponseLines
        .map(line => {
          const match = line.content.match(/status=(\d{3})/);
          return match
            ? { content: match[1], lineNumber: line.lineNumber }
            : null;
        })
        .filter(status => status !== null)
        .filter(status => status.content !== '200');

      onTestFailed(_ => {
        logMessage(
          'error',
          'Reported received unexpected response from Sequencer! Tips:',
          'The failure of this test indicates that at some point the sequencer ' +
            'returned a status different than 200. Please examine the logs:\n\n' +
            `${getLogsLines(statusCodes, 'reporter-a')}`,
          150,
        );
      });
      expect(statusCodes.length).toBe(0);
    });
  });
});
