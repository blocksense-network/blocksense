import { vi, describe, expect, test, afterEach, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

import { selectDirectory } from './fs';
import { write } from 'fs';

describe('selectDirectory', async () => {
  let fsTestFolder = '';
  let writtenFilePath = '';

  beforeEach(async () => {
    fsTestFolder = await fs.mkdtemp(path.join(tmpdir(), 'fsTest-'));
  });

  afterEach(async () => {
    await fs.rm(fsTestFolder, { recursive: true });
  });

  test('should write text content to a file and then be able to read it', async () => {
    const { write, read } = selectDirectory(fsTestFolder);
    const args = {
      base: 'test.txt',
      content: 'Hello, fs utils!',
    };

    writtenFilePath = await write(args);

    expect(writtenFilePath).toBe(path.format({ dir: fsTestFolder, ...args }));
    expect(await fs.stat(writtenFilePath)).toBeTruthy();
    expect(await read(args)).toBe(args.content);
  });

  test('should write JSON content to a file and then be able to read it', async () => {
    const { writeJSON, readJSON } = selectDirectory(fsTestFolder);

    const args = {
      name: 'test',
      ext: '.json',
      content: { message: 'Hello, fs utils!' },
    };

    writtenFilePath = await writeJSON(args);

    expect(writtenFilePath).toBe(path.format({ dir: fsTestFolder, ...args }));
    expect(await fs.stat(writtenFilePath)).toBeTruthy();
    expect(await readJSON(args)).toEqual(args.content);
  });

  test('working with JSON content should work without specifying an extension', async () => {
    const { writeJSON, readJSON } = selectDirectory(fsTestFolder);
    const args = {
      name: 'test',
      content: { message: 'Hello, fs utils!' },
    };

    await writeJSON(args);

    // We expect that the extension is automatically added, even if it was not specified in args...
    expect(
      await fs.stat(path.format({ dir: fsTestFolder, base: 'test.json' })),
    ).toBeTruthy();

    // ... and that we can read the JSON content back, even without specifying the extension.
    expect(await readJSON(args)).toEqual(args.content);
  });

  test('working with JSON content should allow overwriting the extension', async () => {
    const { writeJSON, readJSON } = selectDirectory(fsTestFolder);
    const args = {
      name: 'test',
      ext: '.yaml',
      content: { message: 'Hello, fs utils!' },
    };

    await writeJSON(args);

    expect(
      await fs.stat(path.format({ dir: fsTestFolder, ...args })),
    ).toBeTruthy();

    expect(await readJSON(args)).toEqual(args.content);
  });

  test('should throw an error when `baseDir` does not exists', async () => {
    expect(() => selectDirectory('non-existent-directory')).toThrowError(
      `The directory non-existent-directory does not exist.`,
    );
  });
});
