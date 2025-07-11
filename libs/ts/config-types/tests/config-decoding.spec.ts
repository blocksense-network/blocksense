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
  configDirs,
  readConfig,
  readEvmDeployment,
  readAllEvmDeployments,
  configTypes,
  legacyConfigTypes,
  getConfigFilePath,
} from '../src/read-write-config';
import { DeploymentConfigV2 } from '../src/evm-contracts-deployment';
import {
  downloadAndDecodeFile,
  isTokenValid,
} from '../src/dfcg/artifacts/legacy-dfcg-artifacts-downloader';

describe('Configuration files decoding', async () => {
  const LEGACY_CONFIGS_DIR = 'configs';

  for (const configType of keysOf(configTypes)) {
    test(`should decode '${configType}' config file successfully`, async () => {
      if ((await isTokenValid()) && configType in legacyConfigTypes) {
        const config = await downloadAndDecodeFile(
          getConfigFilePath(configType, LEGACY_CONFIGS_DIR),
          legacyConfigTypes[configType],
        );
        expect(config).toBeTypeOf('object');
      } else {
        const config = await readConfig(configType);
        expect(config).toBeTypeOf('object');
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
        network: net,
        chainId: metadata.chainId,
        contracts: {
          coreContracts: expect.any(Object),
          safe: {
            AdminMultisig: expect.any(String),
            ReporterMultisig: expect.toBeOneOf([expect.any(String), null]),
          },
          CLAggregatorAdapter: expect.any(Object),
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
