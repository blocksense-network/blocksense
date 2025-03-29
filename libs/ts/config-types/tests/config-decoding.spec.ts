import * as path from 'path';
import { describe, expect, test } from 'vitest';

import { selectDirectory } from '@blocksense/base-utils/fs';
import { configDir, configDirs, configFiles } from '@blocksense/base-utils/env';

import {
  decodeFeedsConfig,
  decodeNewFeedsConfig,
  FeedsConfigSchema,
  NewFeedsConfigSchema,
} from '../src/data-feeds-config';

import {
  ChainlinkCompatibilityConfigSchema,
  decodeChainlinkCompatibilityConfig,
} from '../src/chainlink-compatibility/types';

import {
  DeploymentConfigSchemaV1,
  decodeDeploymentConfigV1,
  DeploymentConfigSchemaV2,
  decodeDeploymentConfigV2,
} from '../src/evm-contracts-deployment';

describe('Configuration files decoding', async () => {
  const { readJSON, decodeJSON } = selectDirectory(configDir);

  // Names of the configuration files
  const feedConfigV1 = path.parse(configFiles.feeds_config_v1).name;
  const feedConfigV2 = path.parse(configFiles.feeds_config_v2).name;
  const chainlinkCompatibilityV1 = path.parse(
    configFiles.chainlink_compatibility_v1,
  ).name;
  const chainlinkCompatibilityV2 = path.parse(
    configFiles.chainlink_compatibility_v2,
  ).name;
  const evmContractsDeploymentV1 = path.parse(
    configFiles.evm_contracts_deployment_v1,
  ).name;

  test('should decode v1 feeds config successfully', async () => {
    {
      expect(
        async () => await decodeJSON({ name: feedConfigV1 }, FeedsConfigSchema),
      ).not.toThrow();
    }

    {
      const feedConfigV1Content = JSON.parse(
        JSON.stringify(await readJSON({ name: feedConfigV1 })),
      );
      expect(() => decodeFeedsConfig(feedConfigV1Content)).not.toThrow();
    }
  });

  test('should decode v2 feeds config successfully', async () => {
    {
      expect(
        async () =>
          await decodeJSON({ name: feedConfigV2 }, NewFeedsConfigSchema),
      ).not.toThrow();
    }

    {
      const feedConfigV2Content = await readJSON({ name: feedConfigV2 });
      expect(() => decodeNewFeedsConfig(feedConfigV2Content)).not.toThrow();
    }
  });

  test('should decode v1 chainlink compatibility config successfully', async () => {
    {
      expect(
        async () =>
          await decodeJSON(
            { name: chainlinkCompatibilityV1 },
            ChainlinkCompatibilityConfigSchema,
          ),
      ).not.toThrow();
    }

    {
      const chainlinkCompatibilityV1Content = JSON.parse(
        JSON.stringify(await readJSON({ name: chainlinkCompatibilityV1 })),
      );
      expect(() =>
        decodeChainlinkCompatibilityConfig(chainlinkCompatibilityV1Content),
      ).not.toThrow();
    }
  });

  test('should decode v2 chainlink compatibility config successfully', async () => {
    {
      expect(
        async () =>
          await decodeJSON(
            { name: chainlinkCompatibilityV2 },
            ChainlinkCompatibilityConfigSchema,
          ),
      ).not.toThrow();
    }

    {
      const chainlinkCompatibilityV2Content = JSON.parse(
        JSON.stringify(await readJSON({ name: chainlinkCompatibilityV2 })),
      );
      expect(() =>
        decodeChainlinkCompatibilityConfig(chainlinkCompatibilityV2Content),
      ).not.toThrow();
    }
  });

  test('should decode v1 evm contracts deployment config successfully', async () => {
    {
      expect(
        async () =>
          await decodeJSON(
            { name: evmContractsDeploymentV1 },
            DeploymentConfigSchemaV1,
          ),
      ).not.toThrow();
    }

    {
      const evmContractsDeploymentV1Content = JSON.parse(
        JSON.stringify(await readJSON({ name: evmContractsDeploymentV1 })),
      );
      expect(() =>
        decodeDeploymentConfigV1(evmContractsDeploymentV1Content),
      ).not.toThrow();
    }
  });

  test('should decode v2 evm contracts deployment config successfully', async () => {
    const {
      decodeJSON: EvmContractsDeploymentV2Files,
      readAllJSONFiles: readEvmContractsDeploymentV2Files,
    } = selectDirectory(configDirs.evm_contracts_deployment_v2);

    const files = await readEvmContractsDeploymentV2Files();

    {
      files.forEach(file => {
        expect(async () => {
          try {
            await EvmContractsDeploymentV2Files(
              { base: file.base },
              DeploymentConfigSchemaV2,
            );
          } catch (error) {
            throw new Error(
              `Failed to decode file: "${file.base}". \nError: ${error}`,
            );
          }
        }).not.toThrow();
      });
    }

    {
      files.forEach(file => {
        expect(() => {
          try {
            decodeDeploymentConfigV2(file.content);
          } catch (error) {
            throw new Error(
              `Failed to decode file: "${file.base}". \nError: ${error}`,
            );
          }
        }).not.toThrow();
      });
    }
  });
});
