import { stat } from 'fs/promises';
import { join } from 'path';
import { parse } from 'toml';
import { Command, Options } from '@effect/cli';
import { Effect } from 'effect';

import { renderTui, drawTable } from '@blocksense/base-utils/tty';
import { rootDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';

export interface OracleMetadata {
  name: string;
  description: string;
  path: string;
}

async function getOraclesDirs(): Promise<Array<string>> {
  const oraclesDir = join(rootDir, 'apps', 'oracles');
  const oracles: Array<string> = [];

  try {
    const { readDir } = selectDirectory(oraclesDir);
    const entries = await readDir();

    // Filter for directories only and check for Cargo.toml files
    for (const entry of entries) {
      const entryPath = join(oraclesDir, entry);

      try {
        const stats = await stat(entryPath);
        const cargoTomlPath = join(entryPath, 'Cargo.toml');
        const hasCargoToml = await stat(cargoTomlPath)
          .then(() => true)
          .catch(() => false);

        if (stats.isDirectory() && hasCargoToml) {
          oracles.push(entryPath);
        }
      } catch (error) {
        console.error(`Error processing entry ${entry}:`, error);
      }
    }

    return oracles.sort();
  } catch (error) {
    console.error(`Error reading oracles directory:`, error);
    throw error;
  }
}

async function parseOracleData(oracleDir: string): Promise<OracleMetadata> {
  const { read } = selectDirectory(oracleDir);
  const tomlFile = await read({ base: 'Cargo.toml' });

  const content = parse(tomlFile);

  return {
    name: content?.package?.name,
    description: content?.package?.description,
    path: oracleDir,
  };
}

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
        const oracles = yield* Effect.tryPromise(getOraclesDirs);

        if (oracles.length === 0) {
          console.log('No oracles found.');
          return;
        }

        const oraclesData = yield* Effect.forEach(oracles, oracleDir =>
          Effect.tryPromise(() => parseOracleData(oracleDir)),
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
