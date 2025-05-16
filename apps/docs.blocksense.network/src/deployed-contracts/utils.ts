import { DeploymentConfigV2 } from '@blocksense/config-types';
import { DeploymentConfigArray } from './types';

export function prepareDeploymentData(
  deploymentConfig: DeploymentConfigArray,
  feedName: string,
): DeploymentConfigV2[] {
  return deploymentConfig.map(data => {
    const clAggregatorAdapter = data.contracts.CLAggregatorAdapter[feedName];
    return {
      network: data.network,
      chainId: data.chainId,
      contracts: {
        coreContracts: data.contracts.coreContracts!,
        CLAggregatorAdapter: { [feedName]: clAggregatorAdapter },
        ReporterMultisig: data.contracts.ReporterMultisig,
        AdminMultisig: data.contracts.AdminMultisig,
      },
    };
  });
}
