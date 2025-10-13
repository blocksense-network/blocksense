import { stat } from 'fs/promises';
import { join } from 'path';

import { Effect } from 'effect';
import { Command, Options } from '@effect/cli';
import { parse } from 'toml';

import { rootDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { drawTable, renderTui } from '@blocksense/base-utils/tty';

export const list = Command.make(
  'list',
  {
    displayMode: Options.choice('display-mode', [
      'table',
      'markdown-list',
    ]).pipe(Options.withDefault('table')),
  },
  ({ displayMode }) =>
    Effect.gen(function* () {
      return yield* Effect.gen(function* () {
        const oracles = yield* getOraclesDirs();

        if (oracles.length === 0) {
          console.log('No oracles found.');
          return;
        }

        const oraclesData = yield* Effect.forEach(oracles, oracleDir =>
          parseOracleData(oracleDir),
        );

        if (displayMode === 'markdown-list') {
          for (const o of oraclesData) {
            console.log(`### ${o.name}`);
            console.log(`- description: ${o.description ?? ''}`);
            console.log(`- path ${o.path}`);
            console.log('');
          }
          return;
        }

        const headers = ['Name', 'Description', 'Path'];
        const rows = oraclesData.map(o => [o.name, o.description, o.path]);

        renderTui(
          drawTable(rows, {
            headers,
          }),
        );
      });
    }),
);
export interface OracleMetadata {
  name: string;
  description: string;
  path: string;
}

function getOraclesDirs(): Effect.Effect<string[], Error> {
  return Effect.gen(function* () {
    const oraclesDir = join(rootDir, 'apps', 'oracles');
    const oracles: string[] = [];

    const { readDir } = selectDirectory(oraclesDir);
    const entries = yield* Effect.tryPromise({
      try: () => readDir(),
      catch: e =>
        new Error(
          `Failed to read oracles directory '${oraclesDir}': ${String((e as any)?.message ?? e)}`,
        ),
    });

    // Filter for directories only and check for Cargo.toml files
    for (const entry of entries) {
      const entryPath = join(oraclesDir, entry);

      yield* Effect.gen(function* () {
        const stats = yield* Effect.tryPromise(() => stat(entryPath));
        const cargoTomlPath = join(entryPath, 'Cargo.toml');

        const hasCargoToml = yield* Effect.tryPromise(() =>
          stat(cargoTomlPath),
        ).pipe(
          Effect.as(true),
          Effect.catchAll(() => Effect.succeed(false)),
        );

        if (stats.isDirectory() && hasCargoToml) {
          oracles.push(entryPath);
        }
      }).pipe(
        Effect.catchAll(error =>
          Effect.sync(() => {
            console.error(`Error processing entry ${entry}:`, error);
          }),
        ),
      );
    }

    return oracles.sort();
  }).pipe(
    Effect.tapError(error =>
      Effect.sync(() => {
        console.error(`Error reading oracles directory:`, error);
      }),
    ),
  );
}

function parseOracleData(
  oracleDir: string,
): Effect.Effect<OracleMetadata, Error> {
  return Effect.gen(function* () {
    const { read } = selectDirectory(oracleDir);
    const tomlFile = yield* Effect.tryPromise({
      try: () => read({ base: 'Cargo.toml' }),
      catch: e =>
        new Error(
          `Failed to read Cargo.toml in '${oracleDir}': ${String((e as any)?.message ?? e)}`,
        ),
    });
    const content = yield* Effect.tryPromise({
      try: () => Promise.resolve().then(() => parse(tomlFile)),
      catch: e =>
        new Error(
          `Failed to parse Cargo.toml in '${oracleDir}': ${String((e as any)?.message ?? e)}`,
        ),
    });

    return {
      name: content?.package?.name,
      description: content?.package?.description,
      path: oracleDir,
    } as OracleMetadata;
  });
}
