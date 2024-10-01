import { join } from 'path';
import { getEnvString } from '.';

/**
 * The root directory of the Git repository.
 */
export const rootDir = getEnvString('GIT_ROOT');

/**
 * The root configuration directory.
 */
export const configDir = join(rootDir, 'config');

export const configFiles = {
  ['feeds_config']: join(configDir, 'feeds_config.json'),
  ['chainlink_compatibility']: join(configDir, 'chainlink_compatibility'),
  ['evm_contracts_deployment_v1']: join(
    configDir,
    'evm_contracts_deployment_v1.json',
  ),
};
