import { describe, expect, test } from 'vitest';

import { Schema as S } from 'effect';

import {
  asEnvSchema,
  EnvSchema,
  getEnvString,
  parseEnv,
  parseEnvConfig,
  parsePerNetworkEnv,
} from './functions';
import { networkName } from '../evm';
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
      const parsed = parseEnv('HELLO', S.String, { HELLO: 'world' });
      expect(parsed).toEqual('world');
    });

    test('should throw an error if the variable is not set', () => {
      expect(() => parseEnv('HELLO', S.String)).toThrowError(
        "Env variable 'HELLO' is missing.",
      );
    });

    test('should parse string with validation', () => {
      const parsed = parseEnv(
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
        parseEnv('HELLO', S.NonEmptyTrimmedString.pipe(S.uppercased()), {
          HELLO: ' ',
        }),
      ).toThrowError();

      expect(() =>
        parseEnv('HELLO', S.NonEmptyTrimmedString.pipe(S.uppercased()), {
          HELLO: 'hello',
        }),
      ).toThrowError();
    });

    test('should parse comma-separated list of numbers', () => {
      const parsed = parseEnv(
        'NUMBERS',
        fromCommaSeparatedString(S.NumberFromString),
        { NUMBERS: '1,2,3' },
      );
      expect(parsed).toEqual([1, 2, 3]);
    });

    test('should parse comma-separated list of bigints', () => {
      const parsed = parseEnv('NUMBERS', fromCommaSeparatedString(S.BigInt), {
        NUMBERS: '1,2,3,36893488147419103000',
      });
      expect(parsed).toEqual([1n, 2n, 3n, 36893488147419103000n]);
    });

    // test commaSeparated list of network names
    test('should parse comma-separated list of network names', () => {
      const parsed = parseEnv(
        'NETWORKS',
        fromCommaSeparatedString(networkName),
        { NETWORKS: 'ethereum-mainnet,arbitrum-sepolia' },
      );
      expect(parsed).toEqual(['ethereum-mainnet', 'arbitrum-sepolia']);
    });
  });

  describe('parsePerNetworkEnv', () => {
    test('should parse environment variable for a specific network', () => {
      expect(
        parsePerNetworkEnv('HELLO', 'ethereum-mainnet', S.String, {
          HELLO_ETHEREUM_MAINNET: 'world',
        }),
      ).toEqual('world');

      expect(
        parsePerNetworkEnv('hello', 'ethereum-mainnet', S.String, {
          HELLO_ETHEREUM_MAINNET: 'world',
        }),
      ).toEqual('world');

      expect(
        parsePerNetworkEnv('HELLO', 'arbitrum-sepolia', S.String, {
          HELLO_ARBITRUM_SEPOLIA: 'world',
        }),
      ).toEqual('world');

      expect(
        parsePerNetworkEnv('HELLO', 'arbitrum-sepolia', S.String, {
          HELLO_ARBITRUM_SEPOLIA: 'arbitrum',
          HELLO_ETHEREUM_MAINNET: 'ethereum',
        }),
      ).toEqual('arbitrum');

      expect(
        parsePerNetworkEnv('HELLO', 'ethereum-mainnet', S.String, {
          HELLO_ARBITRUM_SEPOLIA: 'arbitrum',
          HELLO_ETHEREUM_MAINNET: 'ethereum',
        }),
      ).toEqual('ethereum');
    });

    test('should throw an error if the variable is not set', () => {
      expect(() =>
        parsePerNetworkEnv('HELLO', 'ethereum-mainnet', S.String),
      ).toThrowError("Env variable 'HELLO_ETHEREUM_MAINNET' is missing.");
    });
  });

  describe('parseEnvConfig', () => {
    const testSchema1 = {
      NAME: asEnvSchema(S.NonEmptyTrimmedString),
      AMOUNT: asEnvSchema(S.NumberFromString),
    } satisfies EnvSchema;

    test('should parse environment variables correctly', () => {
      const parsed = parseEnvConfig(testSchema1, {
        NAME: 'Alice',
        AMOUNT: '100',
      });

      expect(parsed).toEqual({
        NAME: 'Alice',
        AMOUNT: 100,
      });
    });

    test('should throw an error for missing required variables', () => {
      expect(() =>
        parseEnvConfig(testSchema1, {
          NAME: 'Alice',
        }),
      ).toThrowError("Env variable 'AMOUNT' is missing.");
    });

    test('should throw an error for invalid variable types', () => {
      expect(() =>
        parseEnvConfig(testSchema1, {
          NAME: 'Alice',
          AMOUNT: 'invalid',
        }),
      ).toThrowError();
    });

    test('should throw an error for empty string', () => {
      expect(() =>
        parseEnvConfig(testSchema1, {
          NAME: '',
          AMOUNT: '100',
        }),
      ).toThrowError();
    });

    test('should throw an error for non-string values', () => {
      expect(() =>
        parseEnvConfig(testSchema1, {
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
      const parsed = parseEnvConfig(testSchema2, {
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
  });
});
