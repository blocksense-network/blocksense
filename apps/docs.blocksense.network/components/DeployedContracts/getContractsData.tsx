import DEPLOYMENT_INFO from '@/artifacts/deployment_data.json';

import { parseNetworkName } from '@blocksense/base-utils/evm';
import { DeploymentConfigV2 } from '@blocksense/config-types';
import {
  CoreContract,
  decodeDeploymentConfigArray,
} from '@/src/deployed-contracts/types';

const getCoreContractsData = (networksData: DeploymentConfigV2[]) => {
  const parsedCoreContracts: CoreContract[] = [];

  networksData.map(data => {
    if (!data) return;
    if (data.name === 'local') return;
    const networkName = parseNetworkName(data.name);
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
      if (data.name === 'local') return [];
      const networkName = parseNetworkName(data.name);
      const { CLAggregatorAdapter } = data.contracts;

      return CLAggregatorAdapter.map(proxy => {
        let id = proxy.constructorArgs[2];
        return {
          ...proxy,
          id,
          network: networkName,
        };
      });
    })
    .flat();

  return supportedNetworks;
};

export function getContractsData() {
  const networksData = decodeDeploymentConfigArray(DEPLOYMENT_INFO);
  const parsedCoreContracts = getCoreContractsData(networksData);
  const parsedProxyContracts = getProxyContractsContent(networksData);

  return {
    parsedCoreContracts,
    parsedProxyContracts,
  };
}
