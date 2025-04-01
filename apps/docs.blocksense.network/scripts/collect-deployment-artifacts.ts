import { artifactsFolder } from '@/src/constants';
import { selectDirectory, configDirs } from '@blocksense/base-utils';
import { decodeDeploymentConfigV2 } from '@blocksense/config-types';

export async function collectDeploymentData() {
  const { readAllJSONFiles } = selectDirectory(
    configDirs.evm_contracts_deployment_v2,
  );

  const deploymentFiels = (await readAllJSONFiles()).map(file =>
    decodeDeploymentConfigV2(file.content),
  );

  const { writeJSON } = selectDirectory(artifactsFolder);

  await writeJSON({
    name: 'deployment_data',
    content: deploymentFiels,
  });
}

collectDeploymentData()
  .then(() => {
    console.log('Deployment data collected successfully');
  })
  .catch(error => {
    console.error('Error collecting deployment data:', error);
  });
