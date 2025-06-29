import { DeploymentConfigV2 } from '@blocksense/config-types';
import { DeploymentConfigArray } from './types';

export function prepareDeploymentData(
  deploymentConfig: DeploymentConfigArray,
  feedId: string,
): DeploymentConfigV2[] {
  return deploymentConfig.map(data => {
    const clAggregatorAdapter = data.contracts.CLAggregatorAdapter[feedId];
    return {
      network: data.network,
      chainId: data.chainId,
      contracts: {
        coreContracts: data.contracts.coreContracts,
        CLAggregatorAdapter: { [feedId]: clAggregatorAdapter },
        safe: {
          ReporterMultisig: data.contracts.safe.ReporterMultisig,
          AdminMultisig: data.contracts.safe.AdminMultisig,
          OnlySequencerGuard: null,
          AdminExecutorModule: null,
        },
      },
    };
  });
}
