import { extendConfig, task } from 'hardhat/config';

import './type-extensions';
import { Build } from '../types';
import { relative } from 'path';
import { collectAbi } from '../abiCollector';

extendConfig(config => {
  config.reflect ??= {};
  config.reflect.root = config.paths.root;
  config.reflect.sourcesDir = relative(config.paths.root, config.paths.sources);
});

task('reflect', async (_, hre) => {
  await hre.run('clean');
  await hre.run('compile');

  const { promises: fs } = await import('fs');
  const { main } = await import('../index');

  const buildInfoPaths = await hre.artifacts.getBuildInfoPaths();
  if (buildInfoPaths.length === 0) {
    console.error('No build files found.');
    return;
  }

  let latestBuild: Build = JSON.parse(
    await fs.readFile(buildInfoPaths[0]!, 'utf8'),
  );

  await main(latestBuild, hre.config.reflect);
});

// Task to walk all abi files and combine them into a single JSON file
task('collectABIs', async (_, hre) => {
  await hre.run('clean');
  await hre.run('compile');

  const artifactsPaths = await hre.artifacts.getArtifactPaths();
  await collectAbi(artifactsPaths, hre.config.collectABIs);
});
