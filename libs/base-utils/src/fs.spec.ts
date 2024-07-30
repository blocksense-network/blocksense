import { vi, describe, expect, test, afterEach, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

import { selectDirectory } from './fs';

describe('selectDirectory', async () => {
  let fsTestFolder = '';
  let fsIO: any;

  beforeEach(async () => {
    fsTestFolder = await fs.mkdtemp(path.join(tmpdir(), 'fsTest-'));
    fsIO = selectDirectory(fsTestFolder);
  });

  afterEach(async () => {
    await fs.rm(fsTestFolder, { recursive: true });
  });

  test('should write text content to a file and then be able to read it', async () => {
    const args = {
      base: 'test.txt',
      content: 'Hello, fs utils!',
    };

    await fsIO.write(args);

    expect(
      await fs.stat(path.format({ dir: fsTestFolder, ...args })),
    ).toBeTruthy();

    expect(await fsIO.read(args)).toBe(args.content);
  });

  test('should write JSON content to a file and then be able to read it', async () => {
    const args = {
      name: 'test',
      ext: '.json',
      content: { message: 'Hello, fs utils!' },
    };

    await fsIO.writeJSON(args);

    expect(
      await fs.stat(path.format({ dir: fsTestFolder, ...args })),
    ).toBeTruthy();

    expect(await fsIO.readJSON(args)).toEqual(args.content);
  });

  test('working with JSON content should work without specifying an extension', async () => {
    const args = {
      name: 'test',
      content: { message: 'Hello, fs utils!' },
    };

    await fsIO.writeJSON(args);

    // We expect that the extension is automatically added, even
    expect(
      await fs.stat(path.format({ dir: fsTestFolder, base: 'test.json' })),
    ).toBeTruthy();

    // ... and that we can read the JSON content back, even without specifying the extension.
    expect(await fsIO.readJSON(args)).toEqual(args.content);
  });

  test('working with JSON content should allow overwriting the extension', async () => {
    const args = {
      name: 'test',
      ext: '.yaml',
      content: { message: 'Hello, fs utils!' },
    };

    await fsIO.writeJSON(args);

    expect(
      await fs.stat(path.format({ dir: fsTestFolder, ...args })),
    ).toBeTruthy();

    expect(await fsIO.readJSON(args)).toEqual(args.content);
  });
});
