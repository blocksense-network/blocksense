import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import 'ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import 'solidity-coverage';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
// import "hardhat-tracer";

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: 'http://localhost:8545/',
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
};

export default config;
