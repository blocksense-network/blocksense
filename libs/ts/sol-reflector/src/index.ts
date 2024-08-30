import { Config, defaults } from './config';
import { BuildArtifacts, SolReflection } from './types';
import './hardhat/type-extensions';
import { filterRelevantFiles, writeDocFiles } from './utils/common';
import { addNatspec, convertSourceUnit } from './utils/convertors';
import {
  appendInheritedNatspec,
  appendNatspecDetailsToParams,
} from './utils/natspec';
import { appendAbiToSolReflection, collectAbi } from './abiCollector';
import { formatAndHighlightSignatures } from './utils/signature';
import { enableFileTree } from './contractsFileStructure';

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

  // TODO(issue #476): Remove whitelist, once sol-reflector works with sports data smart contracts.
  const whitelist = [
    'contracts/UpgradeableProxy.sol',
    'contracts/AccessControl.sol',
    'contracts/AggregatedDataFeedStore.sol',
    'contracts/cl-adapters/CLAggregatorAdapter.sol',
    'contracts/cl-adapters/registries/CLFeedRegistryAdapter.sol',
    'contracts/interfaces/ICLAggregatorAdapter.sol',
    'contracts/interfaces/ICLFeedRegistryAdapter.sol',
    'contracts/interfaces/chainlink/IChainlinkAggregator.sol',
    'contracts/interfaces/chainlink/IChainlinkFeedRegistry.sol',
    'contracts/libraries/Blocksense.sol',
  ];

  const solFiles = filterRelevantFiles(build.output, config).filter(
    s => whitelist.indexOf(s.ast.absolutePath) > -1,
  );

  const solPaths = solFiles.map(s => s.ast.absolutePath);

  console.log(
    `Generating docs for the following ${solPaths.length} smart contracts: [${solPaths}]`,
  );

  solFiles.map(({ ast: rawData }) => {
    addNatspec(rawData);
    const fineData = convertSourceUnit(rawData);
    solReflection.push({ rawData, fineData });
  });

  const abiArtifacts = await collectAbi(build.artifactsPaths, userConfig);

  appendInheritedNatspec(solReflection);
  appendNatspecDetailsToParams(solReflection);
  appendAbiToSolReflection(solReflection, abiArtifacts);

  await formatAndHighlightSignatures(solReflection);

  await writeDocFiles(solReflection, userConfig);

  await collectAbi(build.artifactsPaths, userConfig);

  await enableFileTree(userConfig);
}

// We ask Node.js not to cache this file.
delete require.cache[__filename];

export * from './types';
export * from './utils/common';
export * from './utils/natspec';
export * from './utils/convertors';
