import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';

const config: HardhatUserConfig = {
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
    },
  },
  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
