import 'hardhat/types/config';
import { Config, ReflectConfig } from '../config';

declare module 'hardhat/types/config' {
  export interface HardhatUserConfig {
    reflect?: ReflectConfig;
  }

  export interface HardhatConfig {
    reflect: Config;
  }
}
