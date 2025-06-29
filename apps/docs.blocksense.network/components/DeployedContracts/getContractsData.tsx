import DEPLOYMENT_INFO from '@/artifacts/deployment_data.json';

import { entriesOf } from '@blocksense/base-utils/array-iter';
import { DeploymentConfigV2 } from '@blocksense/config-types';
import {
  CoreContract,
  decodeDeploymentConfigArray,
  ProxyContractData,
} from '@/src/deployed-contracts/types';

const getCoreContractsData = (networksData: DeploymentConfigV2[]) => {
  const parsedCoreContracts: CoreContract[] = [];

  networksData.map(data => {
    if (!data) return;
    const networkName = data.network;
    if (networkName === 'local') return;
    const coreContracts = data.contracts.coreContracts;
    const skipContracts = ['AccessControl', 'OnlySequencerGuard'];

    Object.entries(coreContracts).forEach(([contractName, contractsData]) => {
      const existingContract = parsedCoreContracts.find(
        contract => contract.contract === contractName,
      );

      if (existingContract) {
        existingContract.networks.push(networkName);
      } else {
        if (contractsData && !skipContracts.includes(contractName)) {
          parsedCoreContracts.push({
            contract: contractName,
            address: contractsData.address,
            networks: [networkName],
          });
        }
      }
    });
  });
  return parsedCoreContracts;
};

const getProxyContractsContent = (networksData: DeploymentConfigV2[]) => {
  const supportedNetworks = networksData
    .map(data => {
      if (!data) return [];
      const networkName = data.network;
      if (networkName === 'local') return [];
      const { CLAggregatorAdapter } = data.contracts;

      return entriesOf(CLAggregatorAdapter).map(
        ([id, proxy]): ProxyContractData => {
          return {
            id,
            address: proxy.address,
            name: proxy.constructorArgs[0] as string,
            base: proxy.base,
            quote: proxy.quote,
            network: networkName,
          };
        },
      );
    })
    .flat();

  return supportedNetworks;
};

export function getContractsData(): {
  parsedCoreContracts: CoreContract[];
  parsedProxyContracts: ProxyContractData[];
} {
  const networksData = decodeDeploymentConfigArray(DEPLOYMENT_INFO);
  const parsedCoreContracts = getCoreContractsData(networksData);
  const parsedProxyContracts = getProxyContractsContent(networksData);

  return {
    parsedCoreContracts,
    parsedProxyContracts,
  };
}
