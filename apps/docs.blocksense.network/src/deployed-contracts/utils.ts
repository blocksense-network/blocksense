import { DeploymentConfigV2 } from '@blocksense/config-types';
import { DeploymentConfigArray } from './types';

export function prepareDeploymentData(
  deploymentConfig: DeploymentConfigArray,
  feedName: string,
): DeploymentConfigV2[] {
  return deploymentConfig.map(data => {
    const cLAggregatorAdapter = data.contracts.CLAggregatorAdapter.find(
      adapter => adapter.description === feedName,
    );
    return {
      name: data.name,
      chainId: data.chainId,
      contracts: {
        coreContracts: data.contracts.coreContracts!,
        CLAggregatorAdapter: [cLAggregatorAdapter!],
        SequencerMultisig: data.contracts.SequencerMultisig,
        AdminMultisig: data.contracts.AdminMultisig,
      },
    };
  });
}
