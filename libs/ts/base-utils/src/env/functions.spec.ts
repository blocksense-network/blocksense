import { describe, expect, test } from 'vitest';

import { Schema as S } from 'effect';

import {
  asEnvSchema,
  DeploymentEnvSchema,
  EnvSchema,
  getEnvString,
  parseDeploymentEnvConfig,
  parseEnv,
  parseEnvConfig,
  parseNetworkEnvConfig,
  parseOptionalEnv,
  parseRequiredEnv,
} from './functions';
import { ethereumAddress, NetworkName, networkName } from '../evm';
import { fromCommaSeparatedString } from '../schemas';

describe('env', () => {
  describe('getEnvString', () => {
    test('returns the value of an existing environment variable', () => {
      process.env.TEST_VAR = 'test value';
      expect(getEnvString('TEST_VAR')).toBe('test value');
    });

    test('throws an error if the environment variable is not set', () => {
      delete process.env.TEST_VAR;
      expect(() => getEnvString('TEST_VAR')).toThrowError(
        "Env variable 'TEST_VAR' is missing.",
      );
    });
  });

  describe('parseEnv', () => {
    test('should parse string', () => {
      {
        const parsed = parseEnv('HELLO', S.String, false, { HELLO: 'world' });
        expect(parsed).toEqual('world');
      }

      {
        const parsed = parseOptionalEnv('HELLO', S.String, { HELLO: 'world' });
        expect(parsed).toEqual('world');
      }

      {
        const parsed = parseRequiredEnv('HELLO', S.String, { HELLO: 'world' });
        expect(parsed).toEqual('world');
      }
    });

    test('should throw an error if the variable is not set', () => {
      expect(() => parseEnv('HELLO', S.String, false)).toThrowError(
        "Env variable 'HELLO' is missing.",
      );

      expect(() => parseRequiredEnv('HELLO', S.String)).toThrowError(
        "Env variable 'HELLO' is missing.",
      );
    });

    test('should parse string with validation', () => {
      const parsed = parseRequiredEnv(
        'HELLO',
        S.NonEmptyTrimmedString.pipe(S.uppercased()),
        {
          HELLO: 'WORLD',
        },
      );
      expect(parsed).toEqual('WORLD');
    });

    test('should throw an error if the variable is not valid', () => {
      expect(() =>
        parseRequiredEnv(
          'HELLO',
          S.NonEmptyTrimmedString.pipe(S.uppercased()),
          {
            HELLO: ' ',
          },
        ),
      ).toThrowError();

      expect(() =>
        parseRequiredEnv(
          'HELLO',
          S.NonEmptyTrimmedString.pipe(S.uppercased()),
          {
            HELLO: 'hello',
          },
        ),
      ).toThrowError();
    });

    test('should parse comma-separated list of numbers', () => {
      const parsed = parseRequiredEnv(
        'NUMBERS',
        fromCommaSeparatedString(S.NumberFromString),
        { NUMBERS: '1,2,3' },
      );
      expect(parsed).toEqual([1, 2, 3]);
    });

    test('should parse comma-separated list of bigints', () => {
      const parsed = parseRequiredEnv(
        'NUMBERS',
        fromCommaSeparatedString(S.BigInt),
        {
          NUMBERS: '1,2,3,36893488147419103000',
        },
      );
      expect(parsed).toEqual([1n, 2n, 3n, 36893488147419103000n]);
    });

    // test commaSeparated list of network names
    test('should parse comma-separated list of network names', () => {
      const parsed = parseRequiredEnv(
        'NETWORKS',
        fromCommaSeparatedString(networkName),
        { NETWORKS: 'ethereum-mainnet,arbitrum-sepolia' },
      );
      expect(parsed).toEqual(['ethereum-mainnet', 'arbitrum-sepolia']);
    });
  });

  // describe('parsePerNetworkEnv', () => {
  //   test('should parse environment variable for a specific network', () => {
  //     expect(
  //       parsePerNetworkEnv('HELLO', 'ethereum-mainnet', S.String, {
  //         HELLO_ETHEREUM_MAINNET: 'world',
  //       }),
  //     ).toEqual('world');

  //     expect(
  //       parsePerNetworkEnv('hello', 'ethereum-mainnet', S.String, {
  //         HELLO_ETHEREUM_MAINNET: 'world',
  //       }),
  //     ).toEqual('world');

  //     expect(
  //       parsePerNetworkEnv('HELLO', 'arbitrum-sepolia', S.String, {
  //         HELLO_ARBITRUM_SEPOLIA: 'world',
  //       }),
  //     ).toEqual('world');

  //     expect(
  //       parsePerNetworkEnv('HELLO', 'arbitrum-sepolia', S.String, {
  //         HELLO_ARBITRUM_SEPOLIA: 'arbitrum',
  //         HELLO_ETHEREUM_MAINNET: 'ethereum',
  //       }),
  //     ).toEqual('arbitrum');

  //     expect(
  //       parsePerNetworkEnv('HELLO', 'ethereum-mainnet', S.String, {
  //         HELLO_ARBITRUM_SEPOLIA: 'arbitrum',
  //         HELLO_ETHEREUM_MAINNET: 'ethereum',
  //       }),
  //     ).toEqual('ethereum');
  //   });

  //   test('should throw an error if the variable is not set', () => {
  //     expect(() =>
  //       parsePerNetworkEnv('HELLO', 'ethereum-mainnet', S.String),
  //     ).toThrowError("Env variable 'HELLO_ETHEREUM_MAINNET' is missing.");
  //   });
  // });

  describe('parseEnvConfig', () => {
    const testSchema1 = {
      NAME: asEnvSchema(S.NonEmptyTrimmedString),
      AMOUNT: asEnvSchema(S.NumberFromString),
    } satisfies EnvSchema;

    test('should parse environment variables correctly', () => {
      const parsed = parseEnvConfig(testSchema1, '', {
        NAME: 'Alice',
        AMOUNT: '100',
      });

      expect(parsed).toEqual({
        NAME: 'Alice',
        AMOUNT: 100,
      });
    });

    test('should set to null fields whose env var is missing', () => {
      {
        const parsed = parseEnvConfig(testSchema1, '', {
          NAME: 'Alice',
        });

        expect(parsed).toEqual({
          NAME: 'Alice',
          AMOUNT: null,
        });
      }

      {
        const parsed = parseEnvConfig(testSchema1, '', {
          NAME: 'Alice',
          AMOUNT: undefined,
        });

        expect(parsed).toEqual({
          NAME: 'Alice',
          AMOUNT: null,
        });
      }
    });

    // test('should throw an error for missing required variables', () => {
    //   expect(() =>
    //     parseEnvConfig(testSchema1, '', {
    //       NAME: 'Alice',
    //     }),
    //   ).toThrowError("Env variable 'AMOUNT' is missing.");
    // });

    test('should throw an error for invalid variable types', () => {
      expect(() =>
        parseEnvConfig(testSchema1, '', {
          NAME: 'Alice',
          AMOUNT: 'invalid',
        }),
      ).toThrowError();
    });

    test('should throw an error for empty string', () => {
      expect(() =>
        parseEnvConfig(testSchema1, '', {
          NAME: '',
          AMOUNT: '100',
        }),
      ).toThrowError();
    });

    test('should throw an error for non-string values', () => {
      expect(() =>
        parseEnvConfig(testSchema1, '', {
          NAME: 'Alice',
          AMOUNT: 100 as any,
        }),
      ).toThrowError();
    });

    const testSchema2 = {
      MAIN_NETWORK: asEnvSchema(networkName),
      EXTRA_NETWORKS: fromCommaSeparatedString(networkName),
      BLOCK_NUMBER: S.BigInt,
      RPC_URL: S.URL,
    } satisfies EnvSchema;

    test('should parse environment variables with custom schema', () => {
      const parsed = parseEnvConfig(testSchema2, '', {
        MAIN_NETWORK: 'ethereum-mainnet',
        EXTRA_NETWORKS:
          ' arbitrum-sepolia ,   optimism-sepolia,ethereum-sepolia',
        BLOCK_NUMBER: `${2n ** 128n}`,
        RPC_URL: 'https://example.com',
      });

      expect(parsed).toEqual({
        MAIN_NETWORK: 'ethereum-mainnet',
        EXTRA_NETWORKS: [
          'arbitrum-sepolia',
          'optimism-sepolia',
          'ethereum-sepolia',
        ],
        RPC_URL: new URL('https://example.com'),
        BLOCK_NUMBER: 2n ** 128n,
      });
    });

    test('should parse suffixed environment variables with custom schema', () => {
      const parsed = parseEnvConfig(testSchema2, 'SHARED', {
        MAIN_NETWORK_SHARED: 'ethereum-mainnet',
        EXTRA_NETWORKS_SHARED:
          ' arbitrum-sepolia ,   optimism-sepolia,ethereum-sepolia',
        BLOCK_NUMBER_SHARED: `${2n ** 128n}`,
        RPC_URL_SHARED: 'https://example.com',
      });

      expect(parsed).toEqual({
        MAIN_NETWORK: 'ethereum-mainnet',
        EXTRA_NETWORKS: [
          'arbitrum-sepolia',
          'optimism-sepolia',
          'ethereum-sepolia',
        ],
        RPC_URL: new URL('https://example.com'),
        BLOCK_NUMBER: 2n ** 128n,
      });
    });
  });

  describe('parseNetworkEnvConfig', () => {
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
        NETWORKS: fromCommaSeparatedString(networkName),
        RETRIES: S.NumberFromString,
        GAS_LIMIT: S.NumberFromString,
      },
      perNetworkKind: {
        GAS_LIMIT: S.NumberFromString,
        USE_HW_WALLET: asEnvSchema(S.BooleanFromString),
        DEPLOYER: ethereumAddress,
        THRESHOLD: S.NumberFromString,
      },
      perNetworkName: {
        GAS_LIMIT: S.NumberFromString,
        USE_HW_WALLET: asEnvSchema(S.BooleanFromString),
        DEPLOYER: ethereumAddress,
        THRESHOLD: S.NumberFromString,
      },
    } satisfies DeploymentEnvSchema;

    const deploymentTestEnv = {
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

      expect(parse('ethereum-sepolia')).toEqual({
        mergedConfig: {
          NETWORKS: [
            'local',
            'ethereum-sepolia',
            'ethereum-mainnet',
            'arbitrum-sepolia',
            'arbitrum-mainnet',
          ],
          RETRIES: 3,
          GAS_LIMIT: 10e9, // fallback to global
          USE_HW_WALLET: false, // fallback to testnet
          DEPLOYER: '0x2222222222222222222222222222222222222222', // fallback to testnet
          THRESHOLD: 3, // network-specific
        },
        global: {
          NETWORKS: [
            'local',
            'ethereum-sepolia',
            'ethereum-mainnet',
            'arbitrum-sepolia',
            'arbitrum-mainnet',
          ],
          RETRIES: 3,
          GAS_LIMIT: 10e9,
        },
        perNetworkKind: {
          GAS_LIMIT: null,
          USE_HW_WALLET: false,
          DEPLOYER: '0x2222222222222222222222222222222222222222',
          THRESHOLD: 2,
        },
        perNetworkName: {
          GAS_LIMIT: null,
          USE_HW_WALLET: null,
          DEPLOYER: null,
          THRESHOLD: 3,
        },
      });
    });
  });
});
