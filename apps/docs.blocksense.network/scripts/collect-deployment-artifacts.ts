import { artifactsFolder } from '@/src/constants';
import { NetworkName, selectDirectory } from '@blocksense/base-utils';
import { readAllEvmDeployments } from '@blocksense/config-types';

export async function collectDeploymentData() {
  const { writeJSON } = selectDirectory(artifactsFolder);

  const excludeLocalDeployment =
    process.env['NEXT_PUBLIC_EXCLUDE_LOCAL_DEPLOYMENT'] ?? true;

  const excludeLocal: NetworkName[] =
    excludeLocalDeployment === true ? ['local'] : [];

  await writeJSON({
    name: 'deployment_data',
    content: await readAllEvmDeployments(excludeLocal),
  });
}

collectDeploymentData()
  .then(() => {
    console.log('Deployment data collected successfully');
  })
  .catch(error => {
    console.error('Error collecting deployment data:', error);
  });
