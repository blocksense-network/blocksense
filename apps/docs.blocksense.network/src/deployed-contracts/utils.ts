import { DeploymentConfigV2 } from '@blocksense/config-types';
import { AllDeploymentConfig } from './types';
import { entriesOf } from '@blocksense/base-utils/array-iter';

export function prepareDeploymentData(
  deploymentConfig: AllDeploymentConfig,
  feedId: string,
): DeploymentConfigV2[] {
  return [...entriesOf(deploymentConfig)].map(([_, data]) => {
    const clAggregatorAdapter = data.contracts.CLAggregatorAdapter[feedId];
    return {
      network: data.network,
      chainId: data.chainId,
      contracts: {
        coreContracts: data.contracts.coreContracts!,
        CLAggregatorAdapter: { [feedId]: clAggregatorAdapter },
        safe: data.contracts.safe,
      },
    };
  });
}
