import { Config, defaults } from './config';
import { BuildArtifacts, SolReflection } from './types';

import './hardhat/type-extensions';
import { filterRelevantFiles, writeDocFiles } from './utils/common';
import { addNatspec, convertSourceUnit } from './utils/convertors';
import {
  appendInheritedNatspec,
  appendNatspecDetailsToParams,
} from './utils/natspec';
import { collectAbi } from './abiCollector';

if ('extendConfig' in global && 'task' in global) {
  // Assume Hardhat.
  require('./hardhat');
}

export async function main(
  build: BuildArtifacts,
  userConfig?: Config,
): Promise<void> {
  const config = { ...defaults, ...userConfig };
  const solReflection: SolReflection = [];

  const solFiles = filterRelevantFiles(build.output, config);

  solFiles.map(({ ast: rawData }) => {
    addNatspec(rawData);
    const fineData = convertSourceUnit(rawData);
    solReflection.push({ rawData, fineData });
  });

  appendInheritedNatspec(solReflection);
  appendNatspecDetailsToParams(solReflection);

  await writeDocFiles(solReflection, userConfig);

  await collectAbi(build.artifactsPaths, userConfig);
}

// We ask Node.js not to cache this file.
delete require.cache[__filename];

export * from './types';
export * from './utils/common';
export * from './utils/natspec';
export * from './utils/convertors';
