import DEPLOYMENT_INFO from '@/artifacts/deployment_data.json';

import {
  CoreContract,
  decodeAllDeploymentConfig,
  AllDeploymentConfig,
  ProxyContractData,
} from '@/src/deployed-contracts/types';
import { entriesOf } from '@blocksense/base-utils/array-iter';

function getCoreContractsData(
  networksData: AllDeploymentConfig,
): CoreContract[] {
  const parsedCoreContracts: CoreContract[] = [];

  [...entriesOf(networksData)].map(([network, { contracts }]) => {
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
}

function getProxyContractsContent(
  networksData: AllDeploymentConfig,
): ProxyContractData[] {
  return [...entriesOf(networksData)]
    .map(([network, { contracts }]) => {
      return [...entriesOf(contracts.CLAggregatorAdapter)].map(
        ([id, proxy]) => ({
          ...proxy,
          feedId: id,
          network,
        }),
      );
    })
    .flat();
}

export function getContractsData(): {
  parsedCoreContracts: CoreContract[];
  parsedProxyContracts: ProxyContractData[];
} {
  const networksData = decodeAllDeploymentConfig(DEPLOYMENT_INFO);
  const parsedCoreContracts = getCoreContractsData(networksData);
  const parsedProxyContracts = getProxyContractsContent(networksData);

  return {
    parsedCoreContracts,
    parsedProxyContracts,
  };
}
