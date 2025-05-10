import { Either, Schema as S } from 'effect';

import { assertNotNull } from '../assert';
import { kebabToSnakeCase } from '../string';

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
export function parseRequiredEnv<T, S extends string>(
  varName: string,
  schema: VarSchema<T, S>,
  env: NodeJS.ProcessEnv = process.env,
): T {
  return parseEnv(varName, schema, false, env)!;
}

export function parseOptionalEnv<T, S extends string>(
  varName: string,
  schema: VarSchema<T, S>,
  env: NodeJS.ProcessEnv = process.env,
): T | null {
  return parseEnv(varName, schema, true, env);
}

export function parseEnv<T, S extends string>(
  varName: string,
  schema: VarSchema<T, S>,
  optional: boolean = false,
  env: NodeJS.ProcessEnv = process.env,
): T | null {
  const value = S.decodeUnknownEither(schema)(env[varName]);

  if (Either.isLeft(value)) {
    if (env[varName] == null) {
      if (optional) return null;
      throw new Error(`Env variable '${varName}' is missing.`);
    }

    throw new Error(`Env variable '${varName}' is invalid`, {
      cause: value.left,
    });
  } else {
    return value.right;
  }
}

export type VarSchema<T = any, S extends string = string> = S.Schema<T, S>;

export function asEnvSchema<T, S extends string>(
  schema: VarSchema<T, S>,
): S.Schema<T, string> {
  return schema as S.Any as VarSchema<T>;
}

export type EnvSchema = {
  [key: string]: VarSchema;
};

export type EnvTypeFromSchema<T extends EnvSchema> = {
  [K in keyof T]: T[K] extends VarSchema<infer U> ? U | null : never;
};

export function parseEnvConfig<Env$ extends EnvSchema>(
  config: Env$,
  suffix?: string,
  env: NodeJS.ProcessEnv = process.env,
): EnvTypeFromSchema<Env$> {
  const res = {} as EnvTypeFromSchema<Env$>;

  for (const key in config) {
    const varName = kebabToSnakeCase(
      (suffix ?? '').length ? `${key}_${suffix}` : key,
    );
    res[key] = parseEnv(varName, config[key], true, env);
  }

  return res;
}
