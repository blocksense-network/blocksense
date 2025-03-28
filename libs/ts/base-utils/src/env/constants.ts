import { join } from 'path';
import { getEnvString } from './functions';

/**
 * The root directory of the Git repository.
 */
export const rootDir = getEnvString('GIT_ROOT');

/**
 * The root configuration directory.
 */
export const configDir = join(rootDir, 'config');

export const configFiles = {
  ['feeds_config_v1']: join(configDir, 'feeds_config_v1.json'),
  ['feeds_config_v2']: join(configDir, 'feeds_config_v2.json'),
  ['chainlink_compatibility_v1']: join(configDir, 'chainlink_compatibility_v1'),
  ['chainlink_compatibility_v2']: join(configDir, 'chainlink_compatibility_v2'),
  ['evm_contracts_deployment_v1']: join(
    configDir,
    'evm_contracts_deployment_v1.json',
  ),
};

export const configDirs = {
  ['evm_contracts_deployment_v2']: join(
    configDir,
    'evm_contracts_deployment_v2',
  ),
};
