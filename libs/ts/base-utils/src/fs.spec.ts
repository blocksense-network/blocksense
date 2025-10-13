import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { selectDirectory } from './fs';

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
    const { read, write } = selectDirectory(fsTestFolder);
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
    const { readJSON, writeJSON } = selectDirectory(fsTestFolder);

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
    const { readJSON, writeJSON } = selectDirectory(fsTestFolder);
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
    const { readJSON, writeJSON } = selectDirectory(fsTestFolder);
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

  test('write should create all parent dirs of the file', async () => {
    const { write } = selectDirectory(`${fsTestFolder}/non-existent-directory`);
    await write({ base: 'subdir/test.txt', content: "It's alive!" });
    expect(
      await fs.readFile(
        `${fsTestFolder}/non-existent-directory/subdir/test.txt`,
        'utf8',
      ),
    ).toEqual("It's alive!");
  });

  test('readAllJSONFiles should return an empty array when no files are present', async () => {
    const { readAllJSONFiles } = selectDirectory(fsTestFolder);
    expect(await readAllJSONFiles()).toEqual([]);
  });

  test('readAllJSONFiles should return an array of objects with file names and content', async () => {
    const { readAllJSONFiles, writeJSON } = selectDirectory(fsTestFolder);
    const files = [
      { base: 'file1.json', content: { message: 'Hello, fs utils!' } },
      { base: 'file2.json', content: { message: 'Goodbye, fs utils!' } },
    ];

    await Promise.all(files.map(file => writeJSON(file)));

    const result = await readAllJSONFiles();
    expect(result).toEqual(files);

    expect(
      JSON.parse(await fs.readFile(`${fsTestFolder}/file1.json`, 'utf8')),
    ).toEqual(files[0].content);
    expect(
      JSON.parse(await fs.readFile(`${fsTestFolder}/file2.json`, 'utf8')),
    ).toEqual(files[1].content);
  });
});
