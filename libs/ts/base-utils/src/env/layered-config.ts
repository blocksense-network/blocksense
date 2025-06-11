import { Schema as S, Either, Pretty } from 'effect';

import { fromEntries, entriesOf, keysOf } from '../array-iter';
import { assert, assertNotNull } from '../assert';
import { envVarNameJoin } from '../string';
import { RenderArgs, alignRight, color, renderToString, drawBox } from '../tty';
import { UnionToIntersection } from '../type-level';

import {
  EnvSchema,
  EnvTypeFromSchema,
  parseEnvConfig,
  VarSchema,
} from './functions';

export type { EnvSchema, VarSchema, EnvTypeFromSchema } from './functions';

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
  const getColumnWidth = <Str extends string>(cells: Str[]) =>
    cells.reduce((max, cell) => Math.max(max, cell.length), 0);

  const mergedConfigSchema = config.mergedConfigSchema as MergedConfigSchema;
  const mergedConfig = config.mergedConfig as Record<string, unknown>;
  const keys = keysOf(mergedConfigSchema);
  const groupedKeys = entriesOf(
    Object.groupBy(keys, key => mergedConfigSchema[key].layer),
  ).sort(([layerA], [layerB]) => {
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
