import { Either, Pretty, Schema as S } from 'effect';

import { assert, assertNotNull } from '../assert';
import { envVarNameJoin } from '../string';
import { UnionToIntersection } from '../type-level';
import { entriesOf, fromEntries, keysOf } from '../array-iter';
import {
  RenderArgs,
  alignRight,
  renderToString,
  drawBox,
  color as color,
} from '../tty';

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
      if (optional) {
        return null;
      }
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

export function asVarSchema<T, S extends string>(
  schema: S.Schema<T, S>,
): VarSchema<T> {
  return schema as S.Any as VarSchema<T>;
}

export type EnvSchema = {
  [key: string]: VarSchema;
};

export type EnvTypeFromSchema<
  T extends EnvSchema,
  VarsAreOptional extends boolean = true,
> = {
  [K in keyof T]: T[K] extends VarSchema<infer U>
    ? VarsAreOptional extends true
      ? U | null
      : U
    : never;
};

export function parseEnvConfig<Env$ extends EnvSchema>(
  config: Env$,
  suffix?: string,
  env: NodeJS.ProcessEnv = process.env,
): EnvTypeFromSchema<Env$> {
  const res = {} as EnvTypeFromSchema<Env$>;

  for (const key in config) {
    const varName = envVarNameJoin(key, suffix);
    const schema = assertNotNull(
      config[key],
      `Schema at '${key}' is missing for '${varName}' env variable`,
    );
    res[key] = parseEnv(varName, schema, true, env);
  }

  return res;
}

export type LayeredEnvSchema<
  LayerNames extends readonly [string, ...string[]],
  Layers extends Record<LayerNames[number], EnvSchema>,
> = {
  priority: LayerNames;
  suffixes: Record<LayerNames[number], string>;
  layers: Layers;
};

export type LayeredEnvSchemaToConfig<
  LayerNames extends readonly [string, ...string[]],
  Layers extends Record<LayerNames[number], EnvSchema>,
  VarsAreOptional extends boolean = true,
> = {
  priority: LayerNames;
  suffixes: Record<LayerNames[number], string>;
  layers: {
    [key in LayerNames[number]]: EnvTypeFromSchema<
      Layers[key],
      VarsAreOptional
    >;
  };
  mergedConfig: UnionToIntersection<
    {
      [L in keyof LayerNames]: EnvTypeFromSchema<
        Layers[LayerNames[L]],
        VarsAreOptional
      >;
    }[number]
  >;
  mergedConfigSchema: UnionToIntersection<
    {
      [L in keyof LayerNames]: { layer: string; schema: Layers[LayerNames[L]] };
    }[number]
  >;
};

export function parseLayeredEnvConfig<
  LayerNames extends readonly [string, ...string[]],
  Layers extends Record<LayerNames[number], EnvSchema>,
>(
  config: LayeredEnvSchema<LayerNames, Layers>,
  env: NodeJS.ProcessEnv = process.env,
): LayeredEnvSchemaToConfig<LayerNames, Layers> {
  // order schema layers by priority
  const schemaLayers = config.priority.map(
    (layerName: LayerNames[number]) =>
      [layerName, config.layers[layerName]] as const,
  );
  const mergedConfigSchema = mergeSchemaLayers(schemaLayers);

  const mergeSchemaWithoutLayerAnnotations = fromEntries(
    entriesOf(mergedConfigSchema).map(
      ([key, { schema }]) => [key, S.NullOr(schema)] as const,
    ),
  );

  const result = {
    mergedConfigSchema,
    suffixes: config.suffixes,
    priority: config.priority,
    layers: {},
    mergedConfig: {},
  } as LayeredEnvSchemaToConfig<LayerNames, Layers>;

  const mergedConfig = result.mergedConfig as Record<string, any>;
  for (const layerName_ of config.priority) {
    const layerName = layerName_ as LayerNames[number];
    const layer = config.layers[layerName];
    const parsedLayer = parseEnvConfig(layer, config.suffixes[layerName], env);
    result.layers[layerName] = parsedLayer;

    for (const key of keysOf(layer)) {
      if (mergedConfig[key] == null) {
        (result.mergedConfig as any)[key] = parsedLayer[key];
      }
    }
  }

  // Validate the merged configuration against the schema
  const validationResult = S.validateEither(
    S.Struct(mergeSchemaWithoutLayerAnnotations),
  )(result.mergedConfig);

  if (Either.isLeft(validationResult)) {
    throw new Error(
      'Merged configuration is invalid:\n' + validationResult.left,
    );
  }

  return result;
}

export type MergedConfigSchema = Record<
  string,
  { layer: string; schema: VarSchema }
>;

function mergeSchemaLayers(
  layers: Iterable<readonly [string, EnvSchema]>,
): MergedConfigSchema {
  const mergedConfigSchema = {} as MergedConfigSchema;
  for (const [layerName, layer] of layers) {
    for (const key of keysOf(layer)) {
      const schema = layer[key];
      if (!(key in mergedConfigSchema)) {
        mergedConfigSchema[key] = {
          layer: layerName,
          schema: schema as VarSchema,
        };
      } else {
        const schemaToJSON = (schema: S.Schema.All) =>
          JSON.stringify(schema.ast.toJSON(), null, 2);
        // TODO: find a more performant way to check for schema equality
        const s1 = schema;
        const s2 = mergedConfigSchema[key].schema;
        const s1JSON = schemaToJSON(s1);
        const s2JSON = schemaToJSON(s2);
        assert(
          s1JSON === s2JSON,
          `Schema for '${key}' is different at different layers:` +
            `\n  at '${layerName}': '${s1}'` +
            `\n  at '${mergedConfigSchema[key].layer}': '${s2}'` +
            (`${s1}` === `${s2}` ? `\n  ${s1JSON}` + `\n  ${s2JSON}` : ''),
        );
      }
    }
  }

  return mergedConfigSchema;
}

export function reportParsedEnvConfig<
  LayerNames extends readonly [string, ...string[]],
  Layers extends Record<LayerNames[number], EnvSchema>,
>(
  config: LayeredEnvSchemaToConfig<LayerNames, Layers>,
  tty = true,
): {
  missingEnvVariables: string[];
  validationMessage: string;
  isValid: boolean;
} {
  const getColumnWidth = <S extends string>(cells: Iterable<S>) =>
    Iterator.from(cells).reduce((max, cell) => Math.max(max, cell.length), 0);

  const mergedConfigSchema = config.mergedConfigSchema as MergedConfigSchema;
  const mergedConfig = config.mergedConfig as Record<string, unknown>;
  const keys = keysOf(mergedConfigSchema).toArray();
  const groupedKeys = entriesOf(
    Object.groupBy(keys, key => mergedConfigSchema[key].layer),
  )
    .toArray()
    .sort(([layerA], [layerB]) => {
      const indexA = config.priority.indexOf(layerA as LayerNames[number]);
      const indexB = config.priority.indexOf(layerB as LayerNames[number]);
      return indexB - indexA;
    });

  const getVarInfo = (key: string) => {
    const { layer: layer_, schema } = mergedConfigSchema[key];
    assert(
      S.isSchema(schema),
      `Expected schema for '${key}' but got '${schema}'`,
    );
    const layer = layer_ as LayerNames[number];
    const suffix = config.suffixes[layer];
    const envVarName = envVarNameJoin(key, suffix);
    const value = mergedConfig[key];
    return { key, value, layer, envVarName, schema };
  };

  const longestKeyLength = getColumnWidth(keys);
  const longestLayerLength = getColumnWidth(
    groupedKeys.map(([layer]) => layer),
  );
  const columnWidth = Math.max(longestKeyLength, longestLayerLength);

  const missingEnvVariables: string[] = [];
  const formatLayerKeys = (layerKeys: string[]) => (args: RenderArgs) => {
    let layerText = [];
    for (const key of layerKeys) {
      const { envVarName, value, layer, schema } = getVarInfo(key);
      const keyFormatted = `${alignRight(key, columnWidth + 2, ' ')}: `;
      const envVarFormatted = color`({bold ${layer}} env var {bold ${envVarName}})`;

      if (value != null) {
        const prettyPrint = Pretty.make(schema);
        layerText.push(
          keyFormatted +
            color`✅ {bold ${prettyPrint(value)}} {green ${envVarFormatted}}`,
        );
      } else {
        missingEnvVariables.push(envVarName);
        layerText.push(
          keyFormatted + color`❌ {red {underline missing} ${envVarFormatted}}`,
        );
      }
    }
    return layerText;
  };

  const text = renderToString(
    { maxWidth: process.stdout.columns ?? 120 },
    drawBox(
      'Env config',
      ...groupedKeys.map(([layer, layerKeys_]) =>
        drawBox(layer, formatLayerKeys(assertNotNull(layerKeys_))),
      ),
      drawBox('Summary', () =>
        missingEnvVariables.length === 0
          ? [color`{green {bold All env variables are set.}}`]
          : [
              color`{red {bold Missing env variables:}}`,
              ...missingEnvVariables,
            ],
      ),
    ),
  );

  return {
    missingEnvVariables,
    validationMessage: text,
    isValid: missingEnvVariables.length === 0,
  };
}
