import { join } from 'node:path';

import { Schema as S, Either } from 'effect';

import { configDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { NetworkName, parseNetworkName } from '@blocksense/base-utils/evm';

import { FeedsConfigSchema, NewFeedsConfigSchema } from './data-feeds-config';
import { ChainlinkCompatibilityConfigSchema } from './chainlink-compatibility';
import {
  DeploymentConfigSchemaV1,
  DeploymentConfigSchemaV2,
  DeploymentConfigV2,
} from './evm-contracts-deployment';

export function readConfig<Name extends ConfigFileName>(
  configName: Name,
  dir = configDir,
): Promise<ConfigType<Name>> {
  const { decodeJSON } = selectDirectory(dir);
  const { schema } = configFiles[configName];
  return decodeJSON({ name: configName }, schema as S.Schema<any>);
}

export function writeConfig<Name extends ConfigFileName>(
  configName: Name,
  content: ConfigType<Name>,
  dir = configDir,
): Promise<string> {
  const { writeJSON } = selectDirectory(dir);
  const { schema } = configFiles[configName];
  if (!S.is(schema as S.Schema<unknown>)(content)) {
    throw new Error(`Attempt to write invalid config for '${configName}'.`);
  }
  return writeJSON({ name: configName, content });
}

export function readEvmDeployment(
  network: NetworkName,
  throwIfNotFound?: false,
): Promise<DeploymentConfigV2 | null>;
export function readEvmDeployment(
  network: NetworkName,
  throwIfNotFound: true,
): Promise<DeploymentConfigV2>;
export function readEvmDeployment(
  network: NetworkName,
  throwIfNotFound = false,
): Promise<DeploymentConfigV2 | null> {
  const { decodeJSON } = selectDirectory(
    configDirs.evm_contracts_deployment_v2,
  );
  return decodeJSON({ name: network }, DeploymentConfigSchemaV2).catch(err =>
    throwIfNotFound || !err.message.includes('ENOENT')
      ? Promise.reject(err)
      : null,
  );
}

export function listEvmNetworks(
  excludedNetworks: NetworkName[] = [],
): Promise<NetworkName[]> {
  const { readDir } = selectDirectory(configDirs.evm_contracts_deployment_v2);
  return readDir().then(files =>
    files
      .map(file => parseNetworkName(file.replace(/\.json$/, '')))
      .filter(network => !excludedNetworks.includes(network)),
  );
}

export async function readAllEvmDeployments(
  excludedNetworks: NetworkName[],
): Promise<Record<NetworkName, DeploymentConfigV2>> {
  const networks = await listEvmNetworks(excludedNetworks);

  const { decodeJSON } = selectDirectory(
    configDirs.evm_contracts_deployment_v2,
  );

  const result = {} as Record<NetworkName, DeploymentConfigV2>;
  for (const network of networks) {
    result[network] = await decodeJSON(
      { name: network },
      DeploymentConfigSchemaV2,
    );
  }
  return result;
}

export function writeEvmDeployment(
  network: NetworkName,
  data: DeploymentConfigV2,
) {
  const res = S.validateEither(DeploymentConfigSchemaV2)(data);

  if (Either.isLeft(res)) {
    throw new Error(`
EVM contracts deployment v2 does not match schema:
--------------------------------------------------
${res.left}
--------------------------------------------------
`);
  }
  const { writeJSON } = selectDirectory(configDirs.evm_contracts_deployment_v2);
  return writeJSON({
    name: network,
    content: S.encodeSync(DeploymentConfigSchemaV2)(data),
  });
}

export type ConfigFileName = keyof typeof configFiles;

export type ConfigType<Name extends ConfigFileName> = S.Schema.Type<
  (typeof configFiles)[Name]['schema']
>;

export const configFiles = {
  ['feeds_config_v1']: {
    path: `${configDir}/feeds_config_v1.json`,
    schema: FeedsConfigSchema,
  },
  ['feeds_config_v2']: {
    path: `${configDir}/feeds_config_v2.json`,
    schema: NewFeedsConfigSchema,
  },
  ['chainlink_compatibility_v1']: {
    path: `${configDir}/chainlink_compatibility_v1.json`,
    schema: ChainlinkCompatibilityConfigSchema,
  },
  ['chainlink_compatibility_v2']: {
    path: `${configDir}/chainlink_compatibility_v2.json`,
    schema: ChainlinkCompatibilityConfigSchema,
  },
  ['evm_contracts_deployment_v1']: {
    path: `${configDir}/evm_contracts_deployment_v1.json`,
    schema: DeploymentConfigSchemaV1,
  },
} satisfies {
  [name: string]: {
    path: string;
    schema: S.Schema<any>;
  };
};

export { configDir };

export const configDirs = {
  ['evm_contracts_deployment_v2']: join(
    configDir,
    'evm_contracts_deployment_v2',
  ),
};
