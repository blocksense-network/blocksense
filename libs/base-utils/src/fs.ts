import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

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

/**
 * `selectDirectory` is a function that creates a set of file system operations for a specific directory.
 * These operations include writing and reading both plain text and JSON files.
 *
 * @param {string} baseDir - The base directory for the file operations.
 *
 * @returns {Object} An object containing the following methods:
 *
 * - `write`: Writes a string to a file in the base directory.
 *   @param {FileArgs & { content: string }} args - An object containing file path details and the content to write.
 *
 * - `writeJSON`: Writes a JSON object to a file in the base directory.
 *   @param {FileArgs & { content: Record<string, unknown> }} args - An object containing file path details and the JSON content to write.
 *
 * - `read`: Reads a file as a string from the base directory.
 *   @param {FileArgs} args - An object containing file path details.
 *
 * - `readJSON`: Reads a JSON file from the base directory.
 *   @param {FileArgs} args - An object containing file path details.
 *
 * Each `args` object should omit the 'dir' property from the `PathObject` type, as the directory is already specified by `baseDir`.
 */
export function selectDirectory(baseDir: string) {
  type FileArgs = Omit<PathObject, 'dir' | `root`>;

  // Check if the base directory exists
  if (!existsSync(baseDir)) {
    throw new Error(`The directory ${baseDir} does not exist.`);
  }

  return {
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
    write: (args: FileArgs & { content: string }) => {
      const filePath = path.format({ dir: baseDir, ...args });
      return fs.writeFile(filePath, args.content).then(() => {
        return filePath;
      });
    },

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
    writeJSON: (args: FileArgs & { content: Record<string, unknown> }) => {
      const filePath = path.format({ dir: baseDir, ext: '.json', ...args });
      return fs
        .writeFile(filePath, JSON.stringify(args.content, null, 2))
        .then(() => {
          return filePath;
        });
    },

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
    read: (args: FileArgs) =>
      fs.readFile(path.format({ dir: baseDir, ...args }), 'utf8'),

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
    readJSON: (args: FileArgs) =>
      fs
        .readFile(path.format({ dir: baseDir, ext: '.json', ...args }), 'utf8')
        .then(JSON.parse),
  };
}
