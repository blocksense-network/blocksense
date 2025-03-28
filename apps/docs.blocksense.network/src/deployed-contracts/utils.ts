import { keysOf, selectDirectory } from '@blocksense/base-utils';
import {
  decodeDeploymentConfigV2,
  DeploymentConfigV2,
} from '@blocksense/config-types';
import { gitRoot } from '../constants';

export async function prepareDeploymentData(
  feedName: string,
): Promise<DeploymentConfigV2[]> {
  const path = `${gitRoot}/config/evm_contracts_deployment_v2`;

  const { readAllJSONFiles } = selectDirectory(path);

  const deploymentFiels = (await readAllJSONFiles()).map(file =>
    decodeDeploymentConfigV2(file.content),
  );

  return deploymentFiels.map(data => {
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
