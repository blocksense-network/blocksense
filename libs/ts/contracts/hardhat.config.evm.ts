import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-verify';
import 'solidity-coverage';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import '@blocksense/sol-reflector';

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
    // apiKey: "PESU4IQCGNKTRNIT4WMAEJU62I36G5SN8X", //taiko-hekla
    // apiKey: "YNII1S7M8R8HZDHBSFW59QZYZ844G885RR", //linea-sepolia
    // apiKey: "29THUJB42F43HP1T2D562WGHVC7KM6ANRS", //optimism
    // apiKey: "4Q9PKAUNEDXYAWWE5QQ8RT2ENRKDWQVGHJ", //scroll
    // apiKey: "2VXYTAJM2BZAERHFZKCTZA7VC1GMS4FPUS", //polygon
    customChains: [
      {
        network: 'celo-alfajores',
        chainId: 44787,
        urls: {
          apiURL: 'https://celo-alfajores.blockscout.com/api',
          browserURL: 'https://celo-alfajores.blockscout.com/',
        },
      },
      {
        network: 'haiko-tekla',
        chainId: 167009,
        urls: {
          apiURL: 'https://api-hekla.taikoscan.io/api',
          browserURL: 'https://hekla.taikoscan.io/',
        },
      },
      {
        network: 'linea-sepolia',
        chainId: 59141,
        urls: {
          apiURL: 'https://api-sepolia.lineascan.build/api',
          browserURL: 'https://sepolia.lineascan.build/',
        },
      },
      {
        network: 'manta-sepolia',
        chainId: 3441006,
        urls: {
          apiURL: 'https://pacific-explorer.sepolia-testnet.manta.network/api',
          browserURL: 'https://pacific-explorer.sepolia-testnet.manta.network/',
        },
      },
      {
        network: 'optimism-sepolia',
        chainId: 11155420,
        urls: {
          apiURL: 'https://api-sepolia-optimism.etherscan.io//api',
          browserURL: 'https://sepolia-optimism.etherscan.io/',
        },
      },
      {
        network: 'scroll-sepolia',
        chainId: 534351,
        urls: {
          apiURL: 'https://api-sepolia.scrollscan.com/api',
          browserURL: 'https://sepolia.scrollscan.com/',
        },
      },
    ],
  },
};

export default config;
