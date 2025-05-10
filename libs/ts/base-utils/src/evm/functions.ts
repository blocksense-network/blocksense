import assert from 'assert';
import { Schema as S, Either, Equal } from 'effect';

import { keysOf } from '../array-iter';
import {
  EnvSchema,
  EnvTypeFromSchema,
  parseEnvConfig,
  VarSchema,
} from '../env';
import { NetworkName, getNetworkKind } from './networks';

export type DeploymentEnvSchema = {
  global: EnvSchema;
  perNetworkKind: EnvSchema;
  perNetworkName: EnvSchema;
};

export function parseDeploymentEnvConfig<Env$ extends DeploymentEnvSchema>(
  config: Env$,
  network: NetworkName,
  env: NodeJS.ProcessEnv = process.env,
): {
  global: EnvTypeFromSchema<Env$['global']>;
  perNetworkKind: EnvTypeFromSchema<Env$['perNetworkKind']>;
  perNetworkName: EnvTypeFromSchema<Env$['perNetworkName']>;
  mergedConfig: EnvTypeFromSchema<
    Env$['global'] & Env$['perNetworkKind'] & Env$['perNetworkName']
  >;
} {
  const layers = Object.entries(config);
  const mergedConfigSchema = mergeSchemaLayers(layers);

  const networkKind = getNetworkKind(network);
  const global = parseEnvConfig(config.global, '', env);
  const perNetworkName = parseEnvConfig(config.perNetworkName, network, env);
  const perNetworkKind = parseEnvConfig(
    config.perNetworkKind,
    networkKind,
    env,
  );
  const mergedConfig = mergeConfig([perNetworkName, perNetworkKind, global]);

  // Validate the merged configuration against the schema
  const validationResult = S.validateEither(S.Struct(mergedConfigSchema))(
    mergedConfig,
  );

  if (Either.isLeft(validationResult)) {
    throw new Error(
      'Merged configuration is invalid:\n' + validationResult.left,
    );
  }

  return {
    mergedConfig: mergedConfig as any,
    global,
    perNetworkKind,
    perNetworkName,
  };
}

function mergeSchemaLayers(
  layers: [string, EnvSchema][],
): Record<string, VarSchema> {
  const mergedConfigSchema: Record<string, VarSchema> = {};
  for (const [layerName, layer] of layers) {
    for (const key of keysOf(layer)) {
      const schema = layer[key];
      if (!(key in mergedConfigSchema)) {
        mergedConfigSchema[key] = schema;
      } else {
        assert(
          Equal.equals(schema, S.asSchema(mergedConfigSchema[key])),
          `Schema for '${key}' is different at different layers:` +
            `\n  ${schema} (at ${layerName})` +
            `\n  ${mergedConfigSchema[key]}`,
        );
      }
    }
  }
  return mergedConfigSchema;
}

export type Config = Record<string, unknown>;

function mergeConfig(layers: Config[]) {
  const mergedConfig = layers[0];
  for (const key in mergedConfig) {
    if (mergedConfig[key] !== null) continue;

    for (const fallback of layers) {
      if (fallback[key] !== null) {
        mergedConfig[key] = fallback[key];
        break;
      }
    }
  }
  return mergedConfig;
}
