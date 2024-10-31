import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-chai-matchers';

// import '@matterlabs/hardhat-zksync-deploy';
// import '@matterlabs/hardhat-zksync-solc';
import '@matterlabs/hardhat-zksync-node';
// import '@matterlabs/hardhat-zksync-verify';
// import '@matterlabs/hardhat-zksync-ethers';
// import '@matterlabs/hardhat-zksync';

require('@matterlabs/hardhat-zksync-deploy');
require('@matterlabs/hardhat-zksync-solc');
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
  zksolc: {
    version: 'latest',
    // compilerSource: 'binary',
    settings: {},
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
        enabled: false,
        // runs: 200,
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
      zksync: true,
      forking: {
        blockNumber: 20576488,
        enabled: process.env.FORKING === 'true',
        url: getOptionalRpcUrl('ethereum-mainnet'),
      },
      accounts: [
        {
          privateKey:
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
          balance: '1000000000000000000000000000',
        },
      ],
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
    artifacts: './artifacts-zk',
  },
  etherscan: {
    enabled: true,
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
};

export default config;
