import { Either, Pretty, Schema as S } from 'effect';

import { assert, assertNotNull } from '../assert';
import { kebabToSnakeCase, camelCaseSnakeCase } from '../string';
import { UnionToIntersection } from '../type-level';
import { entriesOf, fromEntries, keysOf } from '../array-iter';

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
    const varName = camelCaseSnakeCase(
      (suffix ?? '').length ? `${key}_${suffix}` : key,
    );
    res[key] = parseEnv(varName, config[key], true, env);
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
> = {
  priority: LayerNames;
  suffixes: Record<LayerNames[number], string>;
  layers: {
    [key in LayerNames[number]]: EnvTypeFromSchema<Layers[key]>;
  };
  mergedConfig: UnionToIntersection<
    {
      [L in keyof LayerNames]: EnvTypeFromSchema<Layers[LayerNames[L]]>;
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

export function prettyPrintParsedEnvConfig<
  LayerNames extends readonly [string, ...string[]],
  Layers extends Record<LayerNames[number], EnvSchema>,
>(config: LayeredEnvSchemaToConfig<LayerNames, Layers>, tty = true) {
  const bold = tty ? '\x1B[1m' : '';
  const noBold = tty ? '\x1B[22m' : '';
  const underline = tty ? '\x1B[4m' : '';
  const noUnderline = tty ? '\x1B[24m' : '';
  const red = tty ? '\x1B[31m' : '';
  const green = tty ? '\x1B[32m' : '';
  const noColor = tty ? '\x1B[39m' : '';

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
    const envVarName = kebabToSnakeCase(
      suffix.length ? `${key}_${suffix}` : key,
    );
    const value = mergedConfig[key];
    return { key, value, layer, envVarName, schema };
  };

  const longestKeyLength = getColumnWidth(keys);
  const longestLayerLength = getColumnWidth(
    groupedKeys.map(([layer]) => layer),
  );
  const columnWidth = Math.max(longestKeyLength, longestLayerLength);
  const lineLength = 6 + columnWidth;
  const title = (txt: string) => `╼ ${bold}${txt}${noBold} ╾`;

  const center = (text: string, width: number, padding = '─') => {
    // calculate text width, strip ANSI codes
    const textWidth = text.replace(/\x1B\[[0-9;]*m/g, '').length;
    const leftPadding = Math.max(0, Math.floor((width - textWidth) / 2));
    const rightPadding = Math.max(0, width - textWidth - leftPadding);
    return padding.repeat(leftPadding) + text + padding.repeat(rightPadding);
  };

  const line = (len: number) => '─'.repeat(len);
  if (tty) '─'.repeat(lineLength);
  let text = '';
  text += `╭─${center(title('Env config'), lineLength)}─╮` + '\n';
  for (const [layer, layerKeys] of groupedKeys) {
    text += `├─┬${center(title(layer), lineLength)}╮` + '\n';
    for (const key of assertNotNull(layerKeys)) {
      text += '│ │';
      const { envVarName, value, layer, schema } = getVarInfo(key);

      const keyFormatted = `${key.padStart(columnWidth + 2)}: `;
      const envVarFormatted = `(${bold}${layer}${noBold} env var ${bold}${envVarName}${noBold})`;

      if (value != null) {
        const prettyPrint = Pretty.make(schema);
        text +=
          keyFormatted +
          `✅ ${bold}${underline}${prettyPrint(value)}${noUnderline}${noBold} ` +
          `${green}${envVarFormatted}${noColor}`;
      } else {
        text +=
          keyFormatted +
          `❌ ${red}${underline}missing${noUnderline} ` +
          `${envVarFormatted}${noColor}`;
      }
      text += '\n';
    }
    text += `│ └${line(lineLength)}╯` + '\n';
  }
  text += `╰${line(lineLength + 2)}╯`;

  console.log(text);
}
