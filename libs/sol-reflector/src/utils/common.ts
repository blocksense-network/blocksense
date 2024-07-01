import path from 'path';
import { promises as fs } from 'fs';

import { VariableDeclaration } from 'solidity-ast';
import { SolcOutput } from 'solidity-ast/solc';

import { Config, FullConfig, defaults } from '../config';
import { OutputFormat, SolReflection } from '../types';

/**
 * Writes documentation files based on the provided content and configuration.
 *
 * @param {SolReflection} content - The documentation content to write.
 * @param {Config} [userConfig] - Optional user configuration. If provided, it will be merged with the default configuration.
 * @returns {Promise<void>} - A Promise that resolves when all files have been written.
 */
export async function writeDocFiles(
  content: SolReflection,
  userConfig?: Config,
): Promise<void> {
  const config = { ...defaults, ...userConfig };

  const tasks: Promise<void>[] = [];

  if (
    config.format === OutputFormat.Raw ||
    config.format === OutputFormat.Both
  ) {
    tasks.push(
      writeDocFile(
        'raw.json',
        JSON.stringify(content.map(x => x.rawData)),
        config,
      ),
    );
  }

  if (
    config.format === OutputFormat.Fine ||
    config.format === OutputFormat.Both
  ) {
    tasks.push(
      writeDocFile(
        'fine.json',
        JSON.stringify(content.map(x => x.fineData)),
        config,
      ),
    );
  }

  if (tasks.length === 0) {
    throw new Error('Invalid configuration');
  }

  await Promise.all(tasks);
}

async function writeDocFile(
  fileName: string,
  content: string,
  userConfig?: Config,
) {
  const config = { ...defaults, ...userConfig };
  const filePath = path.resolve(config.root, config.outputDir, fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  console.log(`Wrote documentation to ${filePath}`);
}

/**
 * Checks if a given file path is a child (or a subdirectory) of a specified parent directory.
 *
 * @param {string} file - The file to check.
 * @param {string} parent - The parent directory.
 * @returns {boolean} - Returns true if the file is a child of the parent directory, false otherwise.
 */
export function isChild(file: string, parent: string): boolean {
  return path
    .normalize(file + path.sep)
    .startsWith(path.normalize(parent + path.sep));
}

/**
 * Checks if a file is included based on the provided configuration.
 *
 * @param {string} file - The file to check.
 * @param {FullConfig} config - The configuration to use for the check.
 * @returns {boolean} - Returns true if the file is included, false otherwise.
 */
export function isFileIncluded(file: string, config: FullConfig): boolean {
  return (
    isChild(file, config.sourcesDir) &&
    config.exclude.every(e => !isChild(file, path.join(config.sourcesDir, e)))
  );
}

/**
 * Filters the relevant files from the Solidity compiler output based on the provided configuration.
 *
 * @param {SolcOutput} output - The output from the Solidity compiler.
 * @param {FullConfig} config - The configuration to use for filtering.
 */
export function filterRelevantFiles(output: SolcOutput, config: FullConfig) {
  return Object.values(output.sources).filter(s =>
    isFileIncluded(s.ast.absolutePath, config),
  );
}

/**
 * Format a variable as its type followed by its name, if available.
 */
export function formatVariable(v: VariableDeclaration): string {
  return [v.typeName?.typeDescriptions.typeString!]
    .concat(v.name || [])
    .join(' ');
}

/**
 * Utility type to extract keys of a type.
 * @type {KeysOf<T>}
 */
export type KeysOf<T> = Extract<keyof T, string>;

/**
 * Function to get keys of an object.
 * @param {T} obj - The object to get keys from.
 * @returns {KeysOf<T>[]} - An array of keys of the object.
 */
export function keysOf<T extends {}>(obj: T): KeysOf<T>[] {
  return Object.keys(obj) as KeysOf<T>[];
}

/**
 * Function to extract fields from an object based on a target type.
 * @param {T} obj - The source object to extract fields from.
 * @param {new () => U} target - The constructor of the target type.
 * @returns {U} - An instance of the target type with fields extracted from the source object.
 */
export function extractFields<T extends {}, U extends Partial<T>>(
  obj: T,
  target: new () => U,
): U {
  const result = new target();

  for (const key of keysOf(result)) {
    if (key in obj) {
      result[key] = obj[key as unknown as keyof T] as unknown as U[Extract<
        keyof U,
        string
      >];
    }
  }
  return result;
}
