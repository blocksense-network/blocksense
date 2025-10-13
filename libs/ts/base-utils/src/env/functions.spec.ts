import { Schema as S } from 'effect';
import { describe, expect, test } from 'vitest';

import type { NetworkName } from '../evm';
import { networkName } from '../evm';
import { fromCommaSeparatedString } from '../schemas';
import { kebabToScreamingSnakeCase } from '../string';

import type { EnvSchema, VarSchema } from './functions';
import {
  asVarSchema,
  getEnvString,
  parseEnvConfig,
  parseEnvVar,
  parseOptionalEnvVar,
  parseRequiredEnvVar,
} from './functions';

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

  describe('parseEnvVar', () => {
    test('should parse string', () => {
      {
        const parsed = parseEnvVar('HELLO', S.String, false, {
          HELLO: 'world',
        });
        expect(parsed).toEqual('world');
      }

      {
        const parsed = parseOptionalEnvVar('HELLO', S.String, {
          HELLO: 'world',
        });
        expect(parsed).toEqual('world');
      }

      {
        const parsed = parseRequiredEnvVar('HELLO', S.String, {
          HELLO: 'world',
        });
        expect(parsed).toEqual('world');
      }
    });

    test('should throw an error if the variable is not set', () => {
      expect(() => parseEnvVar('HELLO', S.String, false)).toThrowError(
        "Env variable 'HELLO' is missing.",
      );

      expect(() => parseRequiredEnvVar('HELLO', S.String)).toThrowError(
        "Env variable 'HELLO' is missing.",
      );
    });

    test('should parse string with validation', () => {
      const parsed = parseRequiredEnvVar(
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
        parseRequiredEnvVar(
          'HELLO',
          S.NonEmptyTrimmedString.pipe(S.uppercased()),
          {
            HELLO: ' ',
          },
        ),
      ).toThrowError();

      expect(() =>
        parseRequiredEnvVar(
          'HELLO',
          S.NonEmptyTrimmedString.pipe(S.uppercased()),
          {
            HELLO: 'hello',
          },
        ),
      ).toThrowError();
    });

    test('should parse comma-separated list of numbers', () => {
      const parsed = parseRequiredEnvVar(
        'NUMBERS',
        fromCommaSeparatedString(S.NumberFromString),
        { NUMBERS: '1,2,3' },
      );
      expect(parsed).toEqual([1, 2, 3]);
    });

    test('should parse comma-separated list of bigints', () => {
      const parsed = parseRequiredEnvVar(
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
      const parsed = parseRequiredEnvVar(
        'NETWORKS',
        fromCommaSeparatedString(networkName),
        { NETWORKS: 'ethereum-mainnet,arbitrum-sepolia' },
      );
      expect(parsed).toEqual(['ethereum-mainnet', 'arbitrum-sepolia']);
    });

    describe('parsePerNetworkEnv', () => {
      const parsePerNetworkEnv = <T, S extends string>(
        varName: string,
        networkName: NetworkName,
        schema: VarSchema<T, S>,
        env: NodeJS.ProcessEnv = process.env,
      ): T =>
        parseRequiredEnvVar(
          kebabToScreamingSnakeCase(`${varName}_${networkName}`),
          schema,
          env,
        );

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
  });

  describe('parseEnvConfig', () => {
    const testSchema1 = {
      NAME: asVarSchema(S.NonEmptyTrimmedString),
      AMOUNT: asVarSchema(S.NumberFromString),
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
      MAIN_NETWORK: asVarSchema(networkName),
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
});
