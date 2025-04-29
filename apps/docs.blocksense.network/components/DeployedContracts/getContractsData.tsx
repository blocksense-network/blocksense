import { entries } from '@blocksense/base-utils/array-iter';
import { NetworkName } from '@blocksense/base-utils/evm';

import {
  DeploymentConfigV2,
  readAllEvmDeployments,
} from '@blocksense/config-types';
import {
  CoreContract,
  ProxyContractData,
} from '@/src/deployed-contracts/types';

const getCoreContractsData = (
  networksData: Record<NetworkName, DeploymentConfigV2>,
) => {
  const parsedCoreContracts: CoreContract[] = [];

  entries(networksData).map(([network, { contracts }]) => {
    const coreContracts = contracts.coreContracts;
    const skipContracts = ['AccessControl', 'OnlySequencerGuard'];

    Object.entries(coreContracts).forEach(([contractName, contractsData]) => {
      const existingContract = parsedCoreContracts.find(
        contract => contract.contract === contractName,
      );

      if (existingContract) {
        existingContract.networks.push(network);
      } else {
        if (contractsData && !skipContracts.includes(contractName)) {
          parsedCoreContracts.push({
            contract: contractName,
            address: contractsData.address,
            networks: [network],
          });
        }
      }
    });
  });
  return parsedCoreContracts;
};

function getProxyContractsContent(
  networksData: Record<NetworkName, DeploymentConfigV2>,
): ProxyContractData[] {
  return entries(networksData)
    .map(([network, { contracts }]) => {
      return entries(contracts.CLAggregatorAdapter).map(
        ([description, proxy]) => ({
          ...proxy,
          feedId: proxy.feedId.toString(),
          description,
          network,
        }),
      );
    })
    .flat();
}

export async function getContractsData() {
  const networksData = await readAllEvmDeployments(['local']);
  const parsedCoreContracts = getCoreContractsData(networksData);
  const parsedProxyContracts = getProxyContractsContent(networksData);

  return {
    parsedCoreContracts,
    parsedProxyContracts,
  };
}
