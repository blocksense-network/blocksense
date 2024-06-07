import { extendConfig, task } from 'hardhat/config';

import './type-extensions';
import { Build } from '../types';

extendConfig(config => {
  const path = require('path') as typeof import('path');
  config.reflect ??= {};
  config.reflect.root = config.paths.root;
  config.reflect.sourcesDir = path
    .relative(config.paths.root, config.paths.sources)
    .split(path.sep)
    .join(path.posix.sep);
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
