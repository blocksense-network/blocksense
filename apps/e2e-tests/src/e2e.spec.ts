import { afterAll, beforeAll, describe, test } from 'vitest';
import { $ } from 'execa';

import { logProcessComposeInfo } from './utils/logs';

describe.sequential('E2E Tests with process-compose', async () => {
  beforeAll(async () => {
    // Start the process-compose
    logProcessComposeInfo('Starting');
    await $`process-compose up -D`;
  });

  afterAll(async () => {
    // Stop the process-compose
    logProcessComposeInfo('Stopping');
    await $`process-compose down`;
  });
  test('should start the process-compose', async () => {
    const { stdout } = await $`process-compose info`;
    console.log(stdout);
  });
});
