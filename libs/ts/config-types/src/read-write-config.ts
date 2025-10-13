import { join } from 'node:path';

import { Either, Schema as S } from 'effect';

import { configDir } from '@blocksense/base-utils/env';
import type { NetworkName } from '@blocksense/base-utils/evm';
import { parseNetworkName } from '@blocksense/base-utils/evm';
import { selectDirectory } from '@blocksense/base-utils/fs';

import {
  SequencerConfigV1Schema,
  SequencerConfigV2Schema,
} from './node-config/types';
import { ChainlinkCompatibilityConfigSchema } from './chainlink-compatibility';
import { FeedsConfigSchema, NewFeedsConfigSchema } from './data-feeds-config';
import type { DeploymentConfigV2 } from './evm-contracts-deployment';
import {
  DeploymentConfigSchemaV1,
  DeploymentConfigSchemaV2,
} from './evm-contracts-deployment';

export function readConfig<Name extends ConfigFileName>(
  configName: Name,
  dir = configDir,
): Promise<ConfigType<Name>> {
  const { decodeJSON } = selectDirectory(dir);
  const schema = configTypes[configName];
  return decodeJSON({ name: configName }, schema as S.Schema<any>);
}

export function writeConfig<Name extends ConfigFileName>(
  configName: Name,
  content: ConfigType<Name>,
  dir = configDir,
): Promise<string> {
  const { writeJSON } = selectDirectory(dir);
  const schema = configTypes[configName];
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

export type ConfigFileName = keyof typeof configTypes;

export type ConfigType<Name extends ConfigFileName> = S.Schema.Type<
  (typeof configTypes)[Name]
>;

export function getConfigFilePath<Name extends ConfigFileName>(
  configName: Name,
  dir = configDir,
): string {
  return join(dir, `${configName}.json`);
}

// Legacy configs are located in blocksense/dfcg-artifacts repo
export const legacyConfigTypes = {
  ['sequencer_config_v1']: SequencerConfigV1Schema,
  ['evm_contracts_deployment_v1']: DeploymentConfigSchemaV1,
  ['feeds_config_v1']: FeedsConfigSchema,
  ['chainlink_compatibility_v1']: ChainlinkCompatibilityConfigSchema,
} satisfies Record<string, S.Schema<any>>;

export const configTypes = {
  ...legacyConfigTypes,
  ['sequencer_config_v2']: SequencerConfigV2Schema,
  ['feeds_config_v2']: NewFeedsConfigSchema,
  ['chainlink_compatibility_v2']: ChainlinkCompatibilityConfigSchema,
} satisfies Record<string, S.Schema<any>>;

export { configDir };

export const configDirs = {
  ['evm_contracts_deployment_v2']: join(
    configDir,
    'evm_contracts_deployment_v2',
  ),
};
