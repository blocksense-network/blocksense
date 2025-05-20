import { readdir } from 'fs/promises';

import { artifactsFolder } from '@/src/constants';
import { selectDirectory, parseNetworkName } from '@blocksense/base-utils';
import { configDirs, readEvmDeployment } from '@blocksense/config-types';

export async function collectDeploymentData() {
  const deploymentFilenames = await readdir(
    configDirs.evm_contracts_deployment_v2,
  );

  const networks = deploymentFilenames.map(filename =>
    parseNetworkName(filename.replace(/\.json$/, '')),
  );

  const deploymentFiles = await Promise.all(
    networks.map(async net => await readEvmDeployment(net)),
  );

  const { writeJSON } = selectDirectory(artifactsFolder);

  await writeJSON({
    name: 'deployment_data',
    content: deploymentFiles,
  });
}

collectDeploymentData()
  .then(() => {
    console.log('Deployment data collected successfully');
  })
  .catch(error => {
    console.error('Error collecting deployment data:', error);
  });
