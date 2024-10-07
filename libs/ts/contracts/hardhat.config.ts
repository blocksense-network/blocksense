import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-verify';
import 'solidity-coverage';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import '../sol-reflector/src';

import { fromEntries } from '@blocksense/base-utils/array-iter';
import {
  getRpcUrl,
  getOptionalRpcUrl,
  networkName,
  networkMetadata,
} from '@blocksense/base-utils/evm';

import './tasks';

dotenv.config();

const config: HardhatUserConfig = {
  reflect: {
    outputDir: 'artifacts/docs',
    exclude: ['test'],
  },
  collectABIs: { outputDir: 'artifacts/docs', exclude: ['test'] },
  contractsFileStructureAsJSON: {
    outputDir: 'artifacts/docs',
    exclude: ['test'],
  },
  solidity: {
    version: '0.8.24',
    settings: {
      // viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
        // details: {
        //   yulDetails: {
        //     optimizerSteps: 'u',
        //   },
        // },
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
      forking: {
        blockNumber: 20576488,
        enabled: process.env.FORKING === 'true',
        url: getOptionalRpcUrl('ethereum-mainnet'),
      },
    },
    ...fromEntries(
      networkName.literals.map(network => [
        network,
        {
          url: getOptionalRpcUrl(network),
          chainId: networkMetadata[network].chainId,
          accounts: process.env.SIGNER_PRIVATE_KEY
            ? [process.env.SIGNER_PRIVATE_KEY]
            : [],
        },
      ]),
    ),
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
  etherscan: {
    enabled: true,
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
};

export default config;
