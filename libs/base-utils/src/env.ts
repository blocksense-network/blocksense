import { join } from 'path';

import { assertNotNull } from './assert';

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

/**
 * Retrieves the value of an environment variable.
 *
 * @param {string} varName - The name of the environment variable.
 * @returns {string} - The value of the environment variable.
 * @throws {Error} - Throws an error if the environment variable is not set.
 */
export function getEnvString(varName: string): string {
  return assertNotNull(
    process.env[varName],
    `Env variable '${varName}' is missing.`,
  );
}

export function getOptionalEnvString(
  varName: string,
  defaultValue: string,
): string {
  return process.env[varName] ?? defaultValue;
}
