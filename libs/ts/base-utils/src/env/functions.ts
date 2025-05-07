import { Either, Schema as S } from 'effect';

import { assertNotNull } from '../assert';
import { ethereumAddress, networkName, NetworkName } from '../evm';
import { kebabToSnakeCase } from '../string';
import { fromCommaSeparatedString } from '../schemas';

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

export function getEnvStringNotAssert(varName: string): string {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    console.warn(`Env variable '${varName}' is missing or empty.`);
    return '';
  }
  return value;
}

export function parseEnv<T, S extends string>(
  varName: string,
  schema: S.Schema<T, S> | S.Schema<T, S | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): T {
  const coercedSchema = schema as S.Any as S.Schema<T, string>;
  const value = S.decodeUnknownEither(coercedSchema)(env[varName]);

  if (Either.isLeft(value)) {
    if (env[varName] == null)
      throw new Error(`Env variable '${varName}' is missing.`);

    throw new Error(`Env variable '${varName}' is invalid`, {
      cause: value.left,
    });
  } else {
    return value.right;
  }
}

export function parsePerNetworkEnv<T, S extends string>(
  varName: string,
  network: NetworkName,
  schema: S.Schema<T, S> | S.Schema<T, S | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): T {
  const fullVarName = kebabToSnakeCase(`${varName}_${network}`);
  return parseEnv(fullVarName, schema as any as S.Schema<T, string>, env);
}

export type EnvSchema = {
  [key: string]: S.Schema<any, string> | S.Schema<any, string | undefined>;
};

export type EnvTypeFromSchema<T extends EnvSchema> = {
  [K in keyof T]: T[K] extends S.Schema<infer U, string> ? U : never;
};

export function parseEnvConfig<Env$ extends EnvSchema>(
  config: Env$,
  env: NodeJS.ProcessEnv = process.env,
): EnvTypeFromSchema<Env$> {
  const res = {} as EnvTypeFromSchema<Env$>;

  for (const key in config) {
    res[key] = parseEnv(key, config[key], env);
  }

  return res;
}

export function parseNetworkEnvConfig<Env$ extends EnvSchema>(
  config: Env$,
  network: NetworkName,
  env: NodeJS.ProcessEnv = process.env,
): EnvTypeFromSchema<Env$> {
  const res = {} as EnvTypeFromSchema<Env$>;

  for (const key in config) {
    res[key] = parsePerNetworkEnv(key, network, config[key], env);
  }

  return res;
}

export type DeploymentEnvSchema = {
  shared: EnvSchema;
  mainnet: EnvSchema;
  testnet: EnvSchema;
  perNetwork: EnvSchema;
};

export function parseDeploymentEnvConfig<Env$ extends DeploymentEnvSchema>(
  config: Env$,
  network: NetworkName,
  env: NodeJS.ProcessEnv = process.env,
): {
  shared: EnvTypeFromSchema<Env$['shared']>;
  mainnet: EnvTypeFromSchema<Env$['mainnet']>;
  testnet: EnvTypeFromSchema<Env$['testnet']>;
  perNetwork: EnvTypeFromSchema<Env$['perNetwork']>;
} {
  const shared = parseEnvConfig(config.shared, env);
  const mainnet = parseEnvConfig(config.mainnet, env);
  const testnet = parseEnvConfig(config.testnet, env);
  const perNetwork = parseNetworkEnvConfig(config.perNetwork, network, env);
  return { shared, mainnet, testnet, perNetwork };
}

export function asEnvSchema<T, S extends string>(
  schema: S.Schema<T, S>,
): S.Schema<T, string> {
  return schema as S.Any as S.Schema<T, string>;
}
