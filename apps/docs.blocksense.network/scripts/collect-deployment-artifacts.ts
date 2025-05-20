import { artifactsFolder } from '@/src/constants';
import { selectDirectory } from '@blocksense/base-utils';
import { readAllEvmDeployments } from '@blocksense/config-types';

export async function collectDeploymentData() {
  const { writeJSON } = selectDirectory(artifactsFolder);

  await writeJSON({
    name: 'deployment_data',
    content: await readAllEvmDeployments([]),
  });
}

collectDeploymentData()
  .then(() => {
    console.log('Deployment data collected successfully');
  })
  .catch(error => {
    console.error('Error collecting deployment data:', error);
  });
