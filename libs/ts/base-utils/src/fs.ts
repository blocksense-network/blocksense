import * as fs from 'fs/promises';
import * as path from 'path';

import { Schema as S, Either } from 'effect';

/**  An object whose properties represent significant elements of the path. */
// ┌─────────────────────┬────────────┐
// │          dir        │    base    │
// ├──────┬              ├──────┬─────┤
// │ root │              │ name │ ext │
// "  /    home/user/dir / file  .txt "
// └──────┴──────────────┴──────┴─────┘
interface PathObject {
  /**
   * The root of the path such as '/' or 'c:\'
   */
  root?: string | undefined;
  /**
   * The full directory path such as '/home/user/dir' or 'c:\path\dir'
   */
  dir?: string | undefined;
  /**
   * The file name including extension (if any) such as 'index.html'
   */
  base?: string | undefined;
  /**
   * The file extension (if any) such as '.html'
   */
  ext?: string | undefined;
  /**
   * The file name without extension (if any) such as 'index'
   */
  name?: string | undefined;
}

type FileArgs = Omit<PathObject, 'dir' | `root`>;

/**
 * `selectDirectory` is a function that creates a set of file system operations for a specific directory.
 * These operations include writing and reading both plain text and JSON files.
 *
 * @param {string} dir - The base directory for the file operations.
 *
 * @returns {Object} An object containing the following methods:
 *
 * - `write`: Writes a string to a file in the base directory.
 *   @param {FileArgs & { content: string }} args - An object containing file path details and the content to write.
 *
 * - `writeJSON`: Writes a JSON object to a file in the base directory.
 *   @param {FileArgs & { content: unknown }} args - An object containing file path details and the JSON content to write.
 *
 * - `read`: Reads a file as a string from the base directory.
 *   @param {FileArgs} args - An object containing file path details.
 *
 * - `readJSON`: Reads a JSON file from the base directory.
 *   @param {FileArgs} args - An object containing file path details.
 *
 * Each `args` object should omit the 'dir' property from the `PathObject` type, as the directory is already specified by `baseDir`.
 */
export function selectDirectory(dir: string) {
  return new SelectedDirectory(dir);
}

class SelectedDirectory {
  constructor(public readonly dir: string) {}

  /**
   * Writes content to a file at the specified directory.
   *
   * Params:
   * - **args** - The arguments for specifying the file and content.
   * - **args.base** -The file name including extension (if any) such as 'index.html'
   * - **args.ext** - The file extension (if any) such as '.html'
   * - **args.name** - The file name without extension (if any) such as 'index'
   * - **args.content** - The content to be written to the file.
   * @returns A promise that resolves with the file path of the written file.
   */
  write = (args: FileArgs & { content: string }) => {
    const filePath = path.format({ dir: this.dir, ...args });

    // Get the actual base dir in case the file is nested, e.g.
    // selectDirectory('a/b/c').write({ base: 'd/e/f.txt', content: 'Hello' })
    const { dir: baseDir } = path.parse(filePath);

    return fs
      .mkdir(baseDir, { recursive: true }) // ...and create parent dirs as needed.
      .then(() => fs.writeFile(filePath, args.content))
      .then(() => {
        return filePath;
      });
  };

  /**
   * Writes a JSON object to a file at the specified directory.
   *
   * Params:
   * - **args** - The arguments for specifying the file and content.
   * - **args.base** - The file name including extension (if any) such as 'data.json'
   * - **args.ext** - The file extension (if any) such as '.json'.  Defaults to '.json'.
   * - **args.name** - The file name without extension (if any) such as 'data'
   * - **args.content** - The JSON content to be written to the file.
   * @returns A promise that resolves with the file path of the written file.
   */
  writeJSON = (args: FileArgs & { content: unknown }) =>
    this.write({
      ext: '.json',
      ...args,
      content:
        JSON.stringify(
          args.content,
          (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          2,
        ) + '\n',
    });

  /**
   * Reads content from a file at the specified directory.
   *
   * Params:
   * - **args** - The arguments for specifying the file.
   * - **args.base** - The file name including extension (if any) such as 'index.html'
   * - **args.ext** - The file extension (if any) such as '.html'
   * - **args.name** - The file name without extension (if any) such as 'index'
   * @returns A promise that resolves with the file content as a string.
   */
  read = (args: FileArgs) =>
    fs.readFile(path.format({ dir: this.dir, ...args }), 'utf8');

  readDir = (recursive = false) => fs.readdir(this.dir, { recursive });

  /**
   * Reads a JSON object from a file at the specified directory.
   *
   * Params:
   * - **args** - The arguments for specifying the file.
   * - **args.base** - The file name including extension (if any) such as 'data.json'
   * - **args.ext** - The file extension (if any) such as '.json'. Defaults to '.json'.
   * - **args.name** - The file name without extension (if any) such as 'data'
   * @returns A promise that resolves with the parsed JSON object.
   */
  readJSON = (args: FileArgs) =>
    this.read({ ext: '.json', ...args }).then(JSON.parse);

  decodeJSON = async <A, I>(args: FileArgs, schema: S.Schema<A, I, never>) => {
    const json = await this.readJSON(args);
    const res = S.decodeEither(schema)(json);
    if (Either.isLeft(res)) {
      console.error(res.left.message);
      throw new Error(
        `Failed to decode JSON file '${path.format(args)}' with schema: ${schema}`,
      );
    }
    return res.right;
  };

  /**
   * Reads all JSON files in a directory and returns their data.
   *
   * @returns A promise that resolves to an array of objects, each containing the base name of a JSON file and its data.
   */
  readAllJSONFiles = async () => {
    const files = await fs.readdir(this.dir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    return Promise.all(
      jsonFiles.map(base =>
        this.readJSON({ base }).then(content => ({ base, content })),
      ),
    );
  };
}
