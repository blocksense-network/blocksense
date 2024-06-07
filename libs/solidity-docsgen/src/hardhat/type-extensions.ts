import 'hardhat/types/config';
import 'hardhat/types/runtime';
import { Config, UserConfig } from '../config';

declare module 'hardhat/types/config' {
  export interface HardhatUserConfig {
    docgen?: UserConfig;
  }

  export interface HardhatConfig {
    docgen: Config;
  }
}
