import * as React from 'react';
import { Brand } from 'effect/Brand';
import { parseNetworkName } from '@blocksense/base-utils/evm';
import CHAINLINK_COMPATIBILITY from '@blocksense/monorepo/chainlink_compatibility';
import CONTRACTS_DEPLOYMENT_CONFIG from '@blocksense/monorepo/evm_contracts_deployment_v1';
import {
  decodeChainlinkCompatibilityConfig,
  decodeDeploymentConfig,
  DeploymentConfig,
} from '@blocksense/config-types';
import {
  CoreContract,
  ProxyContractData,
} from '@/src/deployed-contracts/types';
import { DeployedContractsClient } from '@/components/DeployedContracts/DeployedContractsClient';

export function getContractsData() {
  const networksData = decodeDeploymentConfig(CONTRACTS_DEPLOYMENT_CONFIG);

  const getCoreContractsData = (networksData: DeploymentConfig) => {
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

  const getProxyContractsContent = (networksData: DeploymentConfig) => {
    type ChainLinkProxyData =
      | (string &
          Brand<'Hex String'> &
          Brand<'Unformatted Data'> &
          Brand<'EthereumAddress'>)
      | undefined
      | null;

    const { blocksenseFeedsCompatibility } = decodeChainlinkCompatibilityConfig(
      CHAINLINK_COMPATIBILITY,
    );
    const supportedNetworks: ProxyContractData[] = Object.entries(networksData)
      .map(([_networkName, networkData]) => {
        if (!networkData) return [];
        if (_networkName === 'local') return [];
        const networkName = parseNetworkName(_networkName);
        const { ChainlinkProxy } = networkData.contracts;

        return ChainlinkProxy.map(proxy => {
          const compatibilityData = Object.entries(
            blocksenseFeedsCompatibility,
          ).find(([_id, data]) => data.description === proxy.description)?.[1];

          if (!compatibilityData) {
            throw new Error(
              `No compatibility data found for ${proxy.description}`,
            );
          }

          const chainLinkProxyData: ChainLinkProxyData =
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

  const parsedCoreContracts = getCoreContractsData(networksData);
  const parsedProxyContracts = getProxyContractsContent(networksData);

  return {
    parsedCoreContracts,
    parsedProxyContracts,
  };
}

type FeedsDataProps = {
  parsedCoreContracts: CoreContract[];
  parsedProxyContracts: ProxyContractData[];
};

export const DeployedContracts = ({
  parsedCoreContracts,
  parsedProxyContracts,
}: FeedsDataProps) => (
  <DeployedContractsClient
    parsedCoreContracts={parsedCoreContracts}
    parsedProxyContracts={parsedProxyContracts}
  />
);
