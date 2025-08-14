import { Suspense } from 'react';

import {
  listEvmNetworks,
  readAllEvmDeployments,
} from '@blocksense/config-types';

import { Feeds } from '../../components/Feeds';

export default async function FeedsPage() {
  const networks = await listEvmNetworks(['local', 'somnia-mainnet']);
  const deploymentInfo = await readAllEvmDeployments([
    'local',
    'somnia-mainnet',
  ]);

  return (
    <Suspense fallback={<p>Loading feeds...</p>}>
      <Feeds networks={networks} deploymentInfo={deploymentInfo} />
    </Suspense>
  );
}
