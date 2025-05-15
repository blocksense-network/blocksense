import { readdir } from 'fs/promises';

import { describe, expect, test } from 'vitest';

import { keysOf } from '@blocksense/base-utils/array-iter';
import { assertNotNull } from '@blocksense/base-utils/assert';
import {
  parseNetworkName,
  networkMetadata,
  NetworkName,
} from '@blocksense/base-utils/evm';

import {
  configFiles,
  configDirs,
  readConfig,
  readEvmDeployment,
  readAllEvmDeployments,
} from '../src/read-write-config';
import { DeploymentConfigV2 } from '../src/evm-contracts-deployment';

describe('Configuration files decoding', async () => {
  for (const configName of keysOf(configFiles)) {
    test(`should decode '${configName}' config file successfully`, async () => {
      try {
        const config = await readConfig(configName);
        expect(config).toBeTypeOf('object');
      } catch (error) {
        // Fail the test and print the full error message
        expect.fail(
          `Failed to read config '${configName}': ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
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

    expect.assertions(2 + 2 * networks.length + 1);

    expect(networks).toHaveLength(deploymentFilenames.length);
    expect(networks.length).toBeGreaterThan(0);

    const deployments: Partial<Record<NetworkName, DeploymentConfigV2>> = {};

    for (const net of networks) {
      const metadata = networkMetadata[net];
      expect(metadata).toBeDefined();
      const deployment = readEvmDeployment(net);
      await expect(deployment).resolves.toMatchObject({
        name: net,
        chainId: metadata.chainId,
        contracts: {
          coreContracts: expect.any(Object),
          CLAggregatorAdapter: expect.any(Object),
          SequencerMultisig: expect.any(String),
          AdminMultisig: expect.any(String),
        },
      });
      deployments[net] = assertNotNull(await deployment);
    }

    const allEvmDeployments = await readAllEvmDeployments([]);
    expect(allEvmDeployments).toEqual(deployments);
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
