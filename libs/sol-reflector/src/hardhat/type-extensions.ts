import 'hardhat/types/config';
import { Config, UserConfig } from '../config';

declare module 'hardhat/types/config' {
  export interface HardhatUserConfig {
    reflect?: UserConfig;
  }

  export interface HardhatConfig {
    reflect: Config;
  }
}
