import * as fs from 'fs/promises';
import * as path from 'path';

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
 *   @param {Object} args - An object containing file path details and the content to write.
 *   @param {string} args.content - The content to write to the file.
 *
 * - `writeJSON`: Writes a JSON object to a file in the base directory.
 *   @param {Object} args - An object containing file path details and the content to write.
 *   @param {Object} args.content - The JSON content to write to the file.
 *
 * - `read`: Reads a file as a string from the base directory.
 *   @param {Object} args - An object containing file path details.
 *
 * - `readJSON`: Reads a JSON file from the base directory.
 *   @param {Object} args - An object containing file path details.
 *
 * Each `args` object should omit the 'dir' property from the `PathObject` type, as the directory is already specified by `baseDir`.
 */
export function selectDirectory(baseDir: string) {
  type Location = Omit<PathObject, 'dir'>;

  return {
    write: (args: Location & { content: string }) =>
      fs.writeFile(path.format({ dir: baseDir, ...args }), args.content),

    writeJSON: (args: Location & { content: Record<string, unknown> }) =>
      fs.writeFile(
        path.format({ dir: baseDir, ...args }),
        JSON.stringify(args.content, null, 2),
      ),

    read: (args: Location) =>
      fs.readFile(path.format({ dir: baseDir, ...args }), 'utf8'),

    readJSON: (args: Location) =>
      fs
        .readFile(path.format({ dir: baseDir, ...args }), 'utf8')
        .then(JSON.parse),
  };
}
