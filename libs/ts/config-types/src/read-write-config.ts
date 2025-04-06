import { join } from 'node:path';

import { Schema } from 'effect';

import { configDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { NetworkName } from '@blocksense/base-utils/evm';

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
  return decodeJSON({ name: configName }, schema as Schema.Schema<any>);
}

export function writeConfig<Name extends ConfigFileName>(
  configName: Name,
  content: ConfigType<Name>,
  dir = configDir,
): Promise<string> {
  const { writeJSON } = selectDirectory(dir);
  const { schema } = configFiles[configName];
  if (!Schema.is(schema as Schema.Schema<unknown>)(content)) {
    throw new Error(`Attempt to write invalid config for '${configName}'.`);
  }
  return writeJSON({ name: configName, content });
}

export function readEvmDeployment(network: NetworkName) {
  const { decodeJSON } = selectDirectory(
    configDirs.evm_contracts_deployment_v2,
  );
  return decodeJSON({ name: network }, DeploymentConfigSchemaV2);
}

export function writeEvmDeployment(
  network: NetworkName,
  data: DeploymentConfigV2,
) {
  const { writeJSON } = selectDirectory(configDirs.evm_contracts_deployment_v2);
  if (!Schema.is(DeploymentConfigSchemaV2)(data)) {
    throw new Error(
      `Attempt to write invalid EVM deployment config for '${network}'.`,
    );
  }
  return writeJSON({ name: network, content: data });
}

export type ConfigFileName = keyof typeof configFiles;

export type ConfigType<Name extends ConfigFileName> = Schema.Schema.Type<
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
    schema: Schema.Schema<any>;
  };
};

export const configDirs = {
  ['evm_contracts_deployment_v2']: join(
    configDir,
    'evm_contracts_deployment_v2',
  ),
};
