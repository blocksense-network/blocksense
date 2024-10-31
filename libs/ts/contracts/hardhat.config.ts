import { HardhatUserConfig } from 'hardhat/types';

let config: HardhatUserConfig;

if (process.env.ZKSYNC) {
  config = require('./hardhat.config.zksync').default;
} else {
  config = require('./hardhat.config.evm').default;
}

export default config;
