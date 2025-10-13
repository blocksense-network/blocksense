import { Schema as S } from 'effect';
import { describe, expect, test } from 'vitest';

import type { EnvSchema } from '../env/functions';
import { asVarSchema, parseEnvConfig } from '../env/functions';
import { fromCommaSeparatedString } from '../schemas';
import { kebabToScreamingSnakeCase } from '../string';

import type { DeploymentEnvSchema } from './functions';
import { parseDeploymentEnvConfig } from './functions';
import { ethereumAddress } from './hex-types';
import type { NetworkName } from './networks';

describe('evm/functions', () => {
  describe('parseNetworkEnvConfig', () => {
    const parseNetworkEnvConfig = (
      schema: EnvSchema,
      networkName: NetworkName,
      env: NodeJS.ProcessEnv,
    ) => parseEnvConfig(schema, kebabToScreamingSnakeCase(networkName), env);

    const testSchema = {
      RPC_URL: S.URL,
      THRESHOLD: S.NumberFromString,
      BLOCK_NUMBER: S.BigInt,
      FEED_IDS: S.Union(S.Literal('all'), fromCommaSeparatedString(S.BigInt)),
    } satisfies EnvSchema;

    test('should parse environment variables for a specific network', () => {
      const parsed = parseNetworkEnvConfig(testSchema, 'ethereum-mainnet', {
        RPC_URL_ETHEREUM_MAINNET: 'https://example.com',
        THRESHOLD_ETHEREUM_MAINNET: '3',
        BLOCK_NUMBER_ETHEREUM_MAINNET: `${2n ** 128n}`,
        FEED_IDS_ETHEREUM_MAINNET: '1,2,3',
      });

      expect(parsed).toEqual({
        RPC_URL: new URL('https://example.com'),
        THRESHOLD: 3,
        BLOCK_NUMBER: 2n ** 128n,
        FEED_IDS: [1n, 2n, 3n],
      });
    });
  });

  describe('parseDeploymentEnvConfig', () => {
    const deploymentTestSchema = {
      global: {
        name: S.String,
        networks: fromCommaSeparatedString(S.String),
        retries: S.NumberFromString,
        gasLimit: S.NumberFromString,
      },
      perNetworkKind: {
        gasLimit: S.NumberFromString,
        useHwWallet: asVarSchema(S.BooleanFromString),
        deployer: ethereumAddress,
        threshold: S.NumberFromString,
      },
      perNetworkName: {
        gasLimit: S.NumberFromString,
        useHwWallet: asVarSchema(S.BooleanFromString),
        deployer: ethereumAddress,
        threshold: S.NumberFromString,
      },
    } satisfies DeploymentEnvSchema;

    const deploymentTestEnv = {
      NAME: '',
      NETWORKS:
        'local, ethereum-sepolia, ethereum-mainnet, arbitrum-sepolia, arbitrum-mainnet',
      RETRIES: '3',

      GAS_LIMIT: `${10e9}`,
      GAS_LIMIT_LOCAL: `${15e9}`,
      GAS_LIMIT_MAINNET: `${10e9}`,
      GAS_LIMIT_ETHEREUM_MAINNET: `${7.5e9}`,
      GAS_LIMIT_ARBITRUM_SEPOLIA: `${25e9}`,

      USE_HW_WALLET_LOCAL: 'true',
      USE_HW_WALLET_TESTNET: 'false',
      USE_HW_WALLET_ETHEREUM_MAINNET: 'true',

      DEPLOYER_LOCAL: '0x1111111111111111111111111111111111111111',
      DEPLOYER_TESTNET: '0x2222222222222222222222222222222222222222',
      DEPLOYER_ETHEREUM_MAINNET: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      DEPLOYER_ARBITRUM_SEPOLIA: '0x0987654321098765432109876543210987654321',

      THRESHOLD_LOCAL: '1',
      THRESHOLD_TESTNET: '2',
      THRESHOLD_ETHEREUM_SEPOLIA: '3',
      THRESHOLD_ETHEREUM_MAINNET: '4',
      THRESHOLD_ARBITRUM_SEPOLIA: '5',
    } satisfies NodeJS.ProcessEnv;

    test('should parse deployment environment variables correctly', () => {
      const parse = (networkName: NetworkName) =>
        parseDeploymentEnvConfig(
          deploymentTestSchema,
          networkName,
          deploymentTestEnv,
        );

      // validateAndPrintDeploymentEnvConfig(parse('arbitrum-mainnet'));

      const ethSepolia = parse('ethereum-sepolia');
      expect(ethSepolia.suffixes).toEqual({
        perNetworkName: 'ETHEREUM_SEPOLIA',
        perNetworkKind: 'TESTNET',
        global: '',
      });
      expect(ethSepolia.mergedConfigSchema).toEqual({
        // Schemas layers are merged in the order of priority
        // perNetworkName > perNetworkKind > global
        gasLimit: {
          layer: 'perNetworkName',
          schema: deploymentTestSchema.perNetworkName.gasLimit,
        },
        useHwWallet: {
          layer: 'perNetworkName',
          schema: deploymentTestSchema.perNetworkName.useHwWallet,
        },
        deployer: {
          layer: 'perNetworkName',
          schema: deploymentTestSchema.perNetworkName.deployer,
        },
        threshold: {
          layer: 'perNetworkName',
          schema: deploymentTestSchema.perNetworkName.threshold,
        },

        name: {
          layer: 'global',
          schema: deploymentTestSchema.global.name,
        },
        networks: {
          layer: 'global',
          schema: deploymentTestSchema.global.networks,
        },
        retries: {
          layer: 'global',
          schema: deploymentTestSchema.global.retries,
        },
      });
      expect(ethSepolia.mergedConfig).toEqual({
        name: '',
        networks: [
          'local',
          'ethereum-sepolia',
          'ethereum-mainnet',
          'arbitrum-sepolia',
          'arbitrum-mainnet',
        ],
        retries: 3,
        gasLimit: 10e9, // fallback to global
        useHwWallet: false, // fallback to testnet
        deployer: '0x2222222222222222222222222222222222222222', // fallback to testnet
        threshold: 3, // network-specific
      });

      expect(ethSepolia.layers).toEqual({
        global: {
          name: '',
          networks: [
            'local',
            'ethereum-sepolia',
            'ethereum-mainnet',
            'arbitrum-sepolia',
            'arbitrum-mainnet',
          ],
          retries: 3,
          gasLimit: 10e9,
        },
        perNetworkKind: {
          gasLimit: null,
          useHwWallet: false,
          deployer: '0x2222222222222222222222222222222222222222',
          threshold: 2,
        },
        perNetworkName: {
          gasLimit: null,
          useHwWallet: null,
          deployer: null,
          threshold: 3,
        },
      });

      expect(parse('ethereum-mainnet').mergedConfig).toEqual({
        name: '',
        networks: [
          'local',
          'ethereum-sepolia',
          'ethereum-mainnet',
          'arbitrum-sepolia',
          'arbitrum-mainnet',
        ],
        retries: 3,
        gasLimit: 7.5e9, // network-specific
        useHwWallet: true, // network-specific
        deployer: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // network-specific
        threshold: 4, // network-specific
      });

      expect(parse('arbitrum-sepolia').mergedConfig).toEqual({
        name: '',
        networks: [
          'local',
          'ethereum-sepolia',
          'ethereum-mainnet',
          'arbitrum-sepolia',
          'arbitrum-mainnet',
        ],
        retries: 3,
        gasLimit: 25e9, // network-specific
        useHwWallet: false, // network-specific
        deployer: '0x0987654321098765432109876543210987654321', // network-specific
        threshold: 5, // network-specific
      });

      expect(parse('arbitrum-mainnet').mergedConfig).toEqual({
        name: '',
        networks: [
          'local',
          'ethereum-sepolia',
          'ethereum-mainnet',
          'arbitrum-sepolia',
          'arbitrum-mainnet',
        ],
        retries: 3,
        gasLimit: 10e9, // fallback to network kind
        useHwWallet: null, // not set
        deployer: null, // not set
        threshold: null, // not set
      });

      expect(parse('local').mergedConfig).toEqual({
        name: '',
        networks: [
          'local',
          'ethereum-sepolia',
          'ethereum-mainnet',
          'arbitrum-sepolia',
          'arbitrum-mainnet',
        ],
        retries: 3,
        gasLimit: 15e9, // network-specific
        useHwWallet: true, // network-specific
        deployer: '0x1111111111111111111111111111111111111111', // network-specific
        threshold: 1, // network-specific
      });
    });
  });
});
