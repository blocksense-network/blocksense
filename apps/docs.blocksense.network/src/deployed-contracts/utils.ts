import { DeploymentConfigV2 } from '@blocksense/config-types';

export function prepareDeploymentData(
  deploymentConfig: DeploymentConfigV2[],
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
