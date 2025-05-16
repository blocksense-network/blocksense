import { Schema as S } from 'effect';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-verify';
import '@nomicfoundation/hardhat-ledger';
import 'solidity-coverage';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import '@blocksense/sol-reflector';

import { fromEntries } from '@blocksense/base-utils/array-iter';
import {
  getOptionalRpcUrl,
  networkName,
  networkMetadata,
  ethereumAddress,
  NetworkName,
} from '@blocksense/base-utils/evm';

import './tasks';
import { assertNotNull, asVarSchema } from '@blocksense/base-utils';

import {
  DeploymentEnvSchema,
  parseDeploymentEnvConfig,
} from '@blocksense/base-utils/evm/functions';

const deployerSchema = {
  global: {},

  perNetworkKind: {
    deployerAddressIsLedger: asVarSchema(S.BooleanFromString),
    deployerAddress: ethereumAddress,
  },

  perNetworkName: {
    deployerAddressIsLedger: asVarSchema(S.BooleanFromString),
    deployerAddress: ethereumAddress,
  },
} satisfies DeploymentEnvSchema;

const deployerConfig = (network: NetworkName) =>
  parseDeploymentEnvConfig(deployerSchema, network);

const localDeployerConfig = deployerConfig('local').mergedConfig;

const config: HardhatUserConfig = {
  reflect: {
    outputDir: 'artifacts/docs',
    exclude: ['test', 'experiments'],
  },
  collectABIs: { outputDir: 'artifacts/docs', exclude: ['test'] },
  enableFileTree: {
    outputDir: 'artifacts/docs',
    exclude: ['test'],
  },
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v6',
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 99999999999,
      forking: {
        blockNumber: 22044232,
        enabled: process.env['FORKING'] === 'true',
        url: getOptionalRpcUrl('ethereum-mainnet'),
      },
      ledgerAccounts: localDeployerConfig.deployerAddressIsLedger
        ? [assertNotNull(localDeployerConfig.deployerAddress)]
        : undefined,
    },
    ...fromEntries(
      networkName.literals.map(network => [
        network,
        {
          url: getOptionalRpcUrl(network),
          chainId: networkMetadata[network].chainId,
          ledgerAccounts: deployerConfig(network).mergedConfig
            .deployerAddressIsLedger
            ? [
                assertNotNull(
                  deployerConfig(network).mergedConfig.deployerAddress,
                ),
              ]
            : undefined,
        },
      ]),
    ),
  },
  gasReporter: {
    enabled: process.env['REPORT_GAS'] === 'true',
    currency: 'USD',
  },
  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
  etherscan: {
    enabled: true,
    apiKey: process.env['ETHERSCAN_API_KEY'] || '',
  },
};

export default config;
