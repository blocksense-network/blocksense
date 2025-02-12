import { parseNetworkName } from '@blocksense/base-utils/evm';
import CHAINLINK_COMPATIBILITY from '@blocksense/data-feeds-config-generator/chainlink_compatibility';
import CONTRACTS_DEPLOYMENT_CONFIG from '@blocksense/data-feeds-config-generator/evm_contracts_deployment_v1';
import {
  decodeChainlinkCompatibilityConfig,
  decodeDeploymentConfigV1,
  DeploymentConfigV1,
} from '@blocksense/config-types';
import {
  CoreContract,
  ProxyContractData,
} from '@/src/deployed-contracts/types';

const getCoreContractsData = (networksData: DeploymentConfigV1) => {
  const parsedCoreContracts: CoreContract[] = [];

  Object.entries(networksData).forEach(([_networkName, networkData]) => {
    if (!networkData) return;
    if (_networkName === 'local') return;
    const networkName = parseNetworkName(_networkName);
    const coreContracts = networkData.contracts.coreContracts;

    Object.entries(coreContracts).forEach(([contractName, contractsData]) => {
      const existingContract = parsedCoreContracts.find(
        contract => contract.contract === contractName,
      );

      if (existingContract) {
        existingContract.networks.push(networkName);
      } else {
        parsedCoreContracts.push({
          contract: contractName,
          address: contractsData.address,
          networks: [networkName],
        });
      }
    });
  });
  return parsedCoreContracts;
};

const getProxyContractsContent = (networksData: DeploymentConfigV1) => {
  const { blocksenseFeedsCompatibility } = decodeChainlinkCompatibilityConfig(
    CHAINLINK_COMPATIBILITY,
  );
  const supportedNetworks: ProxyContractData[] = Object.entries(networksData)
    .map(([_networkName, networkData]) => {
      if (!networkData) return [];
      if (_networkName === 'local') return [];
      const networkName = parseNetworkName(_networkName);
      const { CLAggregatorAdapter } = networkData.contracts;

      return CLAggregatorAdapter.map(proxy => {
        const compatibilityData = Object.entries(
          blocksenseFeedsCompatibility,
        ).find(([_id, data]) => data.description === proxy.description)?.[1];

        if (!compatibilityData) {
          throw new Error(
            `No compatibility data found for ${proxy.description}`,
          );
        }

        const chainLinkProxyData =
          Object.entries(
            compatibilityData.chainlink_compatibility.chainlink_aggregators,
          ).find(([network, _data]) => network === networkName)?.[1] ?? null;

        return {
          ...proxy,
          id: compatibilityData.id,
          network: networkName,
          chainlink_proxy: chainLinkProxyData,
        };
      });
    })
    .flat();
  return supportedNetworks;
};

export function getContractsData() {
  const networksData = decodeDeploymentConfigV1(CONTRACTS_DEPLOYMENT_CONFIG);
  const parsedCoreContracts = getCoreContractsData(networksData);
  const parsedProxyContracts = getProxyContractsContent(networksData);

  return {
    parsedCoreContracts,
    parsedProxyContracts,
  };
}
