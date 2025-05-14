import {
  EnvSchema,
  LayeredEnvSchema,
  LayeredEnvSchemaToConfig,
  parseLayeredEnvConfig,
  validateParsedEnvConfig,
} from '../env';
import { kebabToSnakeCase } from '../string';
import { getNetworkKind, NetworkName } from './networks';

const deploymentEnvLayerPriority = [
  'perNetworkName',
  'perNetworkKind',
  'global',
] as const;

export type DeploymentEnvPriority = typeof deploymentEnvLayerPriority;

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
    perNetworkKind: kebabToSnakeCase(netKind),
    perNetworkName: kebabToSnakeCase(network),
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
  const { isValid, validationMessage } = validateParsedEnvConfig(parsedConfig);

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
