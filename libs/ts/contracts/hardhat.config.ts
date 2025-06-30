import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-viem';
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
} from '@blocksense/base-utils/evm';

import './tasks';
import { getOptionalEnvString } from '@blocksense/base-utils';

dotenv.config();

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
      ledgerAccounts: getOptionalEnvString('LEDGER_ACCOUNT', '')
        ? [getOptionalEnvString('LEDGER_ACCOUNT', '')]
        : undefined,
    },
    ...fromEntries(
      networkName.literals.map(network => [
        network,
        {
          url: getOptionalRpcUrl(network),
          chainId: networkMetadata[network].chainId,
          ledgerAccounts: getOptionalEnvString('LEDGER_ACCOUNT', '')
            ? [getOptionalEnvString('LEDGER_ACCOUNT', '')]
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
