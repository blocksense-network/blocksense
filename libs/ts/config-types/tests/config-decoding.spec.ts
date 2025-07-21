import { readdir } from 'fs/promises';
import { Schema as S } from 'effect';

import { describe, expect, it, test } from 'vitest';

import { entriesOf, keysOf } from '@blocksense/base-utils/array-iter';
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
  ConfigFileName,
} from '../src/read-write-config';
import { DeploymentConfigV2 } from '../src/evm-contracts-deployment';
import {
  downloadAndDecodeFile,
  isTokenValid,
} from '../src/dfcg/artifacts/downloader';
import { join } from 'path';
import { rootDir } from '../../base-utils/src/env/constants';

const LEGACY_CONFIGS_DIR = 'configs';

const tokenValid = await isTokenValid();
if (!tokenValid) {
  console.warn(
    `Skipping tests for legacy configs. Renew GitHub token for /blocksense/dfcg-artifacts repo`,
  );
}

describe.skipIf(!tokenValid)(
  'Legacy configuration files decoding',
  async () => {
    for (const configType of keysOf(legacyConfigTypes)) {
      it(`should decode '${configType}' config file successfully`, async () => {
        const config = await downloadAndDecodeFile(
          getConfigFilePath(configType, LEGACY_CONFIGS_DIR),
          legacyConfigTypes[configType as ConfigFileName],
        );
        expect(config).toBeTypeOf('object');
      });
    }
  },
);

describe('Configuration files decoding', async () => {
  const configTypesWithoutLegacy = Object.fromEntries(
    entriesOf(configTypes).filter(([key]) => !(key in legacyConfigTypes)),
  ) satisfies Record<string, S.Schema<any>>;

  for (const configType of keysOf(configTypesWithoutLegacy)) {
    it(`should decode '${configType}' config file successfully`, async () => {
      const dir =
        configType === 'sequencer_config_v2'
          ? join(rootDir, '/libs/ts/config-types/tests/fixtures')
          : configDirs[configType];
      const config = await readConfig(configType as ConfigFileName, dir);
      expect(config).toBeTypeOf('object');
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
