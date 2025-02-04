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
        blockNumber: 20663021,
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
    // apiKey: '93943646c0994105a2cb6b40f690fdf8',
    // customChains: [
    //   {
    //     network: 'opbnb-testnet',
    //     chainId: 5611,
    //     urls: {
    //       apiURL:
    //         'https://open-platform.nodereal.io/93943646c0994105a2cb6b40f690fdf8/op-bnb-testnet/contract/',
    //       browserURL: 'https://testnet.opbnbscan.com/',
    //     },
    //   },
    // ],
    // apiKey: 'qeeYh3D9jQD8hHKbsv8jvGhtURw0WE0M',
    // customChains: [
    //   {
    //     network: 'cronos-testnet',
    //     chainId: 338,
    //     urls: {
    //       apiURL:
    //         'https://explorer-api.cronos.org/testnet/api/v1/hardhat/contract?apikey=qeeYh3D9jQD8hHKbsv8jvGhtURw0WE0M',
    //       browserURL: 'https://explorer.cronos.org/testnet',
    //     },
    //   },
    // ],
    // apiKey: 'qeeYh3D9jQD8hHKbsv8jvGhtURw0WE0M',
    // customChains: [
    //   {
    //     network: 'kroma-sepolia',
    //     chainId: 2358,
    //     urls: {
    //       apiURL: 'https://blockscout.sepolia.kroma.network/api',
    //       browserURL: 'https://blockscout.sepolia.kroma.network/',
    //     },
    //   },
    // ],
  },
};

export default config;
