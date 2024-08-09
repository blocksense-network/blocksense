import * as path from 'path';

import { selectDirectory } from '@blocksense/base-utils';

import { Config, defaults } from './config';
import { isFileIncluded, writeABIFile } from './utils/common';

export type ArtifactsRecord = Record<string, Record<string, string>>;

export async function replaceFilePathsWithContent(
  artifactsRecord: Record<string, any>,
) {
  for (const key in artifactsRecord) {
    if (
      typeof artifactsRecord[key] === 'object' &&
      artifactsRecord[key] !== null
    ) {
      await replaceFilePathsWithContent(artifactsRecord[key]);
    } else if (
      typeof artifactsRecord[key] === 'string' &&
      artifactsRecord[key].endsWith('.json')
    ) {
      const { dir: artifactDir, name: artifactFileName } = path.parse(
        artifactsRecord[key],
      );
      const { readJSON } = selectDirectory(artifactDir);

      const fileContent = await readJSON({
        name: artifactFileName,
        ext: '.json',
      });
      artifactsRecord[key] = fileContent;
    }
  }
}

/**
 * Collects ABI (Application Binary Interface) from the provided artifacts paths.
 *
 * This function filters the provided paths based on the configuration, then
 * organizes them into an `ArtifactsRecord` object. It then replaces the file
 * paths with their content and writes the ABI to a file.
 *
 * @param {string[]} artifactsPaths - An array of paths to the artifact files.
 * @param {Config} [userConfig] - An optional configuration object. If provided,
 * this will be merged with the default configuration.
 *
 * @returns {Promise<void>} A promise that resolves when the ABI has been written
 * to a file.
 */
export async function collectAbi(
  artifactsPaths: string[],
  userConfig?: Config,
): Promise<void> {
  const artifactsRecord: ArtifactsRecord = {};
  const config = { ...defaults, ...userConfig };

  artifactsPaths
    .filter(a => isFileIncluded(a.replace(/.*\/artifacts\//, ''), config))
    .forEach(artifactPath => {
      const contract = path.parse(artifactPath).name;
      const sourceUnit = path.parse(path.dirname(artifactPath)).name;
      if (!contract || !sourceUnit) {
        throw new Error(`Invalid path: ${artifactPath}`);
      }

      if (!artifactsRecord[sourceUnit]) {
        artifactsRecord[sourceUnit] = {};
      }
      artifactsRecord[sourceUnit]![contract] = artifactPath;
    });

  await replaceFilePathsWithContent(artifactsRecord);
  await writeABIFile(artifactsRecord, config);
}
