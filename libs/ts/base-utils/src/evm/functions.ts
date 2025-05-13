import {
  EnvSchema,
  LayeredEnvSchema,
  LayeredEnvSchemaToConfig,
  parseLayeredEnvConfig,
} from '../env';
import { kebabToScreamingSnakeCase } from '../string';
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
    perNetworkKind: kebabToScreamingSnakeCase(netKind),
    perNetworkName: kebabToScreamingSnakeCase(network),
  };

  return parseLayeredEnvConfig(
    {
      priority: ['perNetworkName', 'perNetworkKind', 'global'],
      suffixes,
      layers: config,
    },
    env,
  );
}
