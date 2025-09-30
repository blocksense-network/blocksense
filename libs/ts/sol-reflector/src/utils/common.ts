import { promises as fs } from 'fs';
import path from 'path';

import type { VariableDeclaration } from 'solidity-ast';
import type { SolcOutput } from 'solidity-ast/solc';

import { selectDirectory } from '@blocksense/base-utils';

import type { ArtifactsRecord } from '../abiCollector';
import type { Config, FullConfig } from '../config';
import { defaults } from '../config';
import type {
  ContractDocItem,
  ContractElement,
  SolReflection,
  SourceUnitDocItem,
  TreeNode,
} from '../types';
import { OutputFormat } from '../types';

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

  const tasks: Array<Promise<void>> = [];

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

export async function writeArtifactFile(
  artifactsRecord:
    | ArtifactsRecord
    | TreeNode<{ path?: string; icon?: 'folder' | 'solidity'; id?: number }>,
  userConfig?: Config,
  name?: string,
) {
  const config = { ...defaults, ...userConfig };

  let writeJSON;
  const baseDir = path.resolve(config.root, config.outputDir);
  try {
    ({ writeJSON } = selectDirectory(baseDir));
  } catch (error: unknown) {
    if (
      (error as Error).message == `The directory ${baseDir} does not exist.`
    ) {
      await fs.mkdir(baseDir, {
        recursive: true,
      });
      ({ writeJSON } = selectDirectory(
        path.resolve(config.root, config.outputDir),
      ));
    } else {
      throw error;
    }
  }

  const artifactsPath = await writeJSON({
    name,
    content: artifactsRecord,
  });
  console.info(`${name} artifacts collected in ${artifactsPath}`);
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
export function keysOf<T extends {}>(obj: T): Array<KeysOf<T>> {
  return Object.keys(obj) as Array<KeysOf<T>>;
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

type SourceUnitContractPair = {
  sourceUnit: SourceUnitDocItem;
  contract: ContractDocItem;
};

/**
 * Iterates over the contracts in the provided Solidity reflection object and
 *   yields them paired with the source unit that contains them.
 *
 * @param {SolReflection} solReflection - The Solidity reflection object to
 *   iterate over.
 *
 * @yields {SourceUnitContractPair} An object containing a source unit from the
 *   `solReflection` object, paired with a contract in that source unit.
 */
export function* iterateContracts(
  solReflection: SolReflection,
): Generator<SourceUnitContractPair> {
  for (const { fineData } of solReflection) {
    if (fineData.contracts) {
      for (const contract of fineData.contracts) {
        yield { sourceUnit: fineData, contract };
      }
    }
  }
}

type SourceUnitContractElementTuple = {
  sourceUnit: SourceUnitDocItem;
  contract: ContractDocItem;
  element: ContractElement;
};

/**
 * Iterates over the elements of the contracts in the provided Solidity
 *   reflection object. Yields the elements in a tuple, together with their
 *   contract, and the source unit that contains the contract.
 *
 * @param {SolReflection} solReflection - The Solidity reflection object to
 *   iterate over.
 *
 * @yields {SourceUnitContractElementTuple} An object containing a source unit
 *   from the `solReflection` object, a contract from that source unit, and an
 *   element from that contract.
 */
export function* iterateContractElements(
  solReflection: SolReflection,
): Generator<SourceUnitContractElementTuple> {
  for (const { contract, sourceUnit } of iterateContracts(solReflection)) {
    const contractElements = [
      contract.functions,
      contract.errors,
      contract.events,
      contract.modifiers,
      contract.variables,
      contract.enums,
      contract.structs,
    ];

    for (const elements of contractElements) {
      if (elements) {
        for (const element of elements) {
          yield { sourceUnit, contract, element };
        }
      }
    }
  }
}

// This function recursively generates a file tree structure for the specified path.

export async function generateFileTree(
  dir: string,
): Promise<TreeNode<{ path: string }>> {
  const tree: TreeNode<{ path: string }> = {
    path: dir,
    name: path.basename(dir),
  };

  const files = await fs.readdir(dir);

  if (files.length > 0) {
    tree['children'] = [];

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        tree['children'].push(await generateFileTree(filePath));
      } else {
        const currentTree: TreeNode<{ path: string }> = {
          path: filePath,
          name: path.basename(filePath),
        };
        tree['children'].push(currentTree);
      }
    }
  }

  return tree;
}
