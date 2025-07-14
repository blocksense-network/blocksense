import DEPLOYMENT_INFO from '@/artifacts/deployment_data.json';

import { entriesOf } from '@blocksense/base-utils/array-iter';
import { DeploymentConfigV2 } from '@blocksense/config-types';
import {
  CoreContract,
  CoreContractsDataAndNetworks,
  CoreContractsPerNetwork,
  decodeDeploymentConfigArray,
  ProxyContractData,
} from '@/src/deployed-contracts/types';
import { NetworkName } from '@blocksense/base-utils/evm/networks';

const getCoreContractsData = (
  networksData: DeploymentConfigV2[],
): CoreContractsDataAndNetworks => {
  const contractsData: (CoreContractsPerNetwork | undefined)[] =
    networksData.map(data => {
      if (!data) return;
      const networkName = data.network;
      if (networkName === 'local') return;

      const skipContracts = ['AccessControl', 'OnlySequencerGuard'];
      const coreContracts = entriesOf(data.contracts.coreContracts)
        .filter(([name, _contract]) => {
          // Filter out contracts that are not relevant for the docs
          return !skipContracts.includes(name);
        })
        .map(([name, contract]): CoreContract => {
          return {
            contract: name,
            address: contract.address,
          };
        });

      return {
        contracts: coreContracts,
        network: networkName as NetworkName,
      };
    });

  const networks = contractsData.map(data => data!.network);
  return { contracts: contractsData, networks };
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
  parsedCoreContracts: CoreContractsDataAndNetworks;
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
