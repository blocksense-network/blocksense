import 'hardhat/types/config';

import type { Config, ReflectConfig } from '../config';

declare module 'hardhat/types/config' {
  export interface HardhatUserConfig {
    reflect?: ReflectConfig;
    collectABIs?: ReflectConfig;
    enableFileTree: ReflectConfig;
  }

  export interface HardhatConfig {
    reflect: Config;
    collectABIs: Config;
    enableFileTree: Config;
  }
}
