import fs from 'fs/promises';

import { extendConfig, task } from 'hardhat/config';

import './type-extensions';
import { BuildArtifacts } from '../types';
import { relative } from 'path';
import { collectAbi } from '../abiCollector';
import { enableFileTree } from '../contractsFileStructure';
import { main } from '..';

extendConfig(config => {
  config.reflect ??= {};
  config.reflect.root = config.paths.root;
  config.reflect.sourcesDir = relative(config.paths.root, config.paths.sources);
});

task('reflect', async (_, hre) => {
  await hre.run('clean');
  await hre.run('compile');

  const buildInfoPaths = await hre.artifacts.getBuildInfoPaths();
  const artifactsPaths = await hre.artifacts.getArtifactPaths();

  if (buildInfoPaths.length === 0) {
    console.error('No build files found.');
    return;
  }

  let latestBuild: BuildArtifacts = JSON.parse(
    await fs.readFile(buildInfoPaths[0]!, 'utf8'),
  );

  await main({ ...latestBuild, artifactsPaths }, hre.config.reflect);
});

// Task to walk all abi files and combine them into a single JSON file
task('collectABIs', async (_, hre) => {
  await hre.run('clean');
  await hre.run('compile');

  const artifactsPaths = await hre.artifacts.getArtifactPaths();
  await collectAbi(artifactsPaths, hre.config.collectABIs);
});

// Task to process the file structure of the Contracts as JSON file
task('enableFileTree', async (_, hre) => {
  await enableFileTree(hre.config.enableFileTree);
});
