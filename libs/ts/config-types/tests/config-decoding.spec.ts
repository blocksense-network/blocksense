import { readdir } from 'fs/promises';

import { describe, expect, test } from 'vitest';

import { keysOf } from '@blocksense/base-utils/array-iter';
import { parseNetworkName } from '@blocksense/base-utils/evm';

import {
  configFiles,
  configDirs,
  readConfig,
  readEvmDeployment,
} from '../src/read-write-config';

describe('Configuration files decoding', async () => {
  for (const configName of keysOf(configFiles)) {
    test(`should decode '${configName}' config file successfully`, async () => {
      await expect(readConfig(configName)).resolves.toBeTypeOf('object');
    });
  }

  test('should decode all v2 evm contracts deployment configs successfully', async () => {
    const deploymentFilenames = await readdir(
      configDirs.evm_contracts_deployment_v2,
    );
    const networks = deploymentFilenames.map(filename =>
      parseNetworkName(filename.replace(/\.json$/, '')),
    );

    for (const net of networks) {
      expect(() => readEvmDeployment(net)).not.toThrow();
    }
  });
});
