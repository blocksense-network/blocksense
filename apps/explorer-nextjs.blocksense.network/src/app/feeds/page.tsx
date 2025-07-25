import {
  listEvmNetworks,
  readAllEvmDeployments,
} from '@blocksense/config-types';

import { Feeds } from '../../components/Feeds';

export default async function FeedsPage() {
  const networks = await listEvmNetworks(['local']);
  const deploymentInfo = await readAllEvmDeployments(['local']);

  return <Feeds networks={networks} deploymentInfo={deploymentInfo} />;
}
