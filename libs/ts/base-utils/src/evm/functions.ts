import type {
  EnvSchema,
  LayeredEnvSchema,
  LayeredEnvSchemaToConfig,
} from '../env/layered-config';
import {
  parseLayeredEnvConfig,
  reportParsedEnvConfig,
} from '../env/layered-config';
import { kebabToScreamingSnakeCase } from '../string';

import type { NetworkName } from './networks';
import { getNetworkKind } from './networks';

const _deploymentEnvLayerPriority = [
  'perNetworkName',
  'perNetworkKind',
  'global',
] as const;

export type DeploymentEnvPriority = typeof _deploymentEnvLayerPriority;

export type DeploymentEnvSchema = LayeredEnvSchema<
  DeploymentEnvPriority,
  Record<DeploymentEnvPriority[number], EnvSchema>
>['layers'];

export function parseDeploymentEnvConfig<
  EnvSchemaLayers extends Record<DeploymentEnvPriority[number], EnvSchema>,
  Network extends NetworkName,
>(
  config: EnvSchemaLayers,
  network: Network,
  env: NodeJS.ProcessEnv = process.env,
): LayeredEnvSchemaToConfig<DeploymentEnvPriority, EnvSchemaLayers> {
  const netKind = getNetworkKind(network);
  const suffixes: Record<DeploymentEnvPriority[number], string> = {
    global: '',
    perNetworkKind: kebabToScreamingSnakeCase(netKind),
    perNetworkName: kebabToScreamingSnakeCase(network),
  };

  const parsedConfig = parseLayeredEnvConfig(
    {
      priority: ['perNetworkName', 'perNetworkKind', 'global'] as const,
      suffixes,
      layers: config,
    },
    env,
  );

  return parsedConfig;
}

export function validateAndPrintDeploymentEnvConfig<
  EnvSchemaLayers extends Record<DeploymentEnvPriority[number], EnvSchema>,
>(
  parsedConfig: LayeredEnvSchemaToConfig<
    DeploymentEnvPriority,
    EnvSchemaLayers,
    true
  >,
): LayeredEnvSchemaToConfig<DeploymentEnvPriority, EnvSchemaLayers, false> {
  const { isValid, validationMessage } = reportParsedEnvConfig(parsedConfig);

  console.log(validationMessage);

  if (!isValid) {
    throw new Error('Invalid deployment env variables');
  }

  return parsedConfig as unknown as LayeredEnvSchemaToConfig<
    DeploymentEnvPriority,
    EnvSchemaLayers,
    false
  >;
}
