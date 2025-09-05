import { describe, expectTypeOf, test } from 'vitest';

import { Schema as S } from 'effect';

import { asVarSchema } from '../env/functions';
import { fromCommaSeparatedString } from '../schemas';
import { EthereumAddress, ethereumAddress } from './hex-types';
import { networkName, NetworkName } from './networks';
import { DeploymentEnvSchema, parseDeploymentEnvConfig } from './functions';

describe('evm/functions', () => {
  describe('parseDeploymentEnvConfig', () => {
    const deploymentTestSchema = {
      global: {
        NETWORKS: fromCommaSeparatedString(networkName),
        RETRIES: S.NumberFromString,
        GAS_LIMIT: S.NumberFromString,
      },
      perNetworkKind: {
        GAS_LIMIT: S.NumberFromString,
        USE_HW_WALLET: asVarSchema(S.BooleanFromString),
        DEPLOYER: asVarSchema(ethereumAddress),
        THRESHOLD: S.NumberFromString,
      },
      perNetworkName: {
        GAS_LIMIT: S.NumberFromString,
        USE_HW_WALLET: asVarSchema(S.BooleanFromString),
        DEPLOYER: asVarSchema(ethereumAddress),
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

      const { layers, mergedConfig } = parse('ethereum-mainnet');

      expectTypeOf(layers).toEqualTypeOf<{
        global: {
          NETWORKS: readonly NetworkName[] | null;
          RETRIES: number | null;
          GAS_LIMIT: number | null;
        };
        perNetworkKind: {
          GAS_LIMIT: number | null;
          USE_HW_WALLET: boolean | null;
          DEPLOYER: EthereumAddress | null;
          THRESHOLD: number | null;
        };
        perNetworkName: {
          GAS_LIMIT: number | null;
          USE_HW_WALLET: boolean | null;
          DEPLOYER: EthereumAddress | null;
          THRESHOLD: number | null;
        };
      }>();

      expectTypeOf({ ...mergedConfig }).toEqualTypeOf<{
        NETWORKS: readonly NetworkName[] | null;
        RETRIES: number | null;
        GAS_LIMIT: number | null;
        USE_HW_WALLET: boolean | null;
        DEPLOYER: EthereumAddress | null;
        THRESHOLD: number | null;
      }>();
    });
  });
});
