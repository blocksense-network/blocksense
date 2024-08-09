import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import 'solidity-coverage';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import '@blocksense/sol-reflector';

dotenv.config();

const config: HardhatUserConfig = {
  reflect: {
    outputDir: 'artifacts/docs',
    exclude: ['test'],
  },
  collectABIs: { outputDir: 'artifacts/docs', exclude: ['test'] },
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
    localhost: {
      url: 'http://localhost:8545/',
    },
    hardhat: {
      forking: {
        blockNumber: 19860864,
        enabled: process.env.FORKING === 'true',
        url: '' + process.env.RPC_URL_ETH_MAINNET,
      },
    },
    sepolia: {
      url: process.env.RPC_URL_ETH_SEPOLIA || '',
      chainId: 11155111,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    holesky: {
      url: process.env.RPC_URL_ETH_HOLESKY || '',
      chainId: 17000,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    amoy: {
      url: process.env.RPC_URL_POLYGON_AMOY || '',
      chainId: 80002,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    mantaSepolia: {
      url: process.env.RPC_URL_MANTA_SEPOLIA || '',
      chainId: 3441006,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    fuji: {
      url: process.env.RPC_URL_AVAX_FUJI || '',
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    chiado: {
      url: process.env.RPC_URL_GNOSIS_CHIADO || '',
      chainId: 10200,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    opSepolia: {
      url: process.env.RPC_URL_OPTIMISM_SEPOLIA || '',
      chainId: 11155420,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    zkSyncSepolia: {
      url: process.env.RPC_URL_ZKSYNC_SEPOLIA || '',
      chainId: 300,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    baseSepolia: {
      url: process.env.RPC_URL_BASE_SEPOLIA || '',
      chainId: 84532,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    specular: {
      url: process.env.RPC_URL_SPECULAR || '',
      chainId: 13527,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    scrollSepolia: {
      url: process.env.RPC_URL_SCROLL_SEPOLIA || '',
      chainId: 534351,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    arbSepolia: {
      url: process.env.RPC_URL_ARBITRUM_SEPOLIA || '',
      chainId: 421614,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    artio: {
      url: process.env.RPC_URL_BERA_ARTIO || '',
      chainId: 80085,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
    hekla: {
      url: process.env.RPC_URL_TAIKO_HEKLA || '',
      chainId: 167009,
      accounts: process.env.USER_PRIVATE_KEY
        ? [process.env.USER_PRIVATE_KEY]
        : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
};

export default config;
