import 'hardhat/types/config';
import { Config, ReflectConfig } from '../config';

declare module 'hardhat/types/config' {
  export interface HardhatUserConfig {
    reflect?: ReflectConfig;
    collectABIs?: ReflectConfig;
    contractsFileStructureAsJSON?: ReflectConfig;
  }

  export interface HardhatConfig {
    reflect: Config;
    collectABIs: Config;
    contractsFileStructureAsJSON: Config;
  }
}
