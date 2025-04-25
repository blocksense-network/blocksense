import { readdir } from 'fs/promises';

import { describe, expect, test } from 'vitest';

import { keysOf } from '@blocksense/base-utils/array-iter';
import { parseNetworkName, networkMetadata } from '@blocksense/base-utils/evm';

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

  test('should decode all v2 evm contracts deployment configs successfully', async ({
    expect,
  }) => {
    const deploymentFilenames = await readdir(
      configDirs.evm_contracts_deployment_v2,
    );
    const networks = deploymentFilenames.map(filename =>
      parseNetworkName(filename.replace(/\.json$/, '')),
    );

    expect(networks).toHaveLength(deploymentFilenames.length);
    expect(networks.length).toBeGreaterThan(0);

    expect.assertions(2 + 2 * networks.length);

    for (const net of networks) {
      const metadata = networkMetadata[net];
      expect(metadata).toBeDefined();
      await expect(readEvmDeployment(net)).resolves.toMatchObject({
        name: net,
        chainId: metadata.chainId,
        contracts: {
          coreContracts: expect.any(Object),
          CLAggregatorAdapter: expect.any(Object),
          SequencerMultisig: expect.any(String),
          AdminMultisig: expect.any(String),
        },
      });
    }
  });

  test('should return null when network deployment is missing', async () => {
    const result = await readEvmDeployment('nonExistentNetwork' as any);
    expect(result).toBeNull();
  });

  test('should throw when network deployment is missing and throwOnError is true', async () => {
    await expect(
      readEvmDeployment('nonExistentNetwork' as any, true),
    ).rejects.toThrow();
  });
});
