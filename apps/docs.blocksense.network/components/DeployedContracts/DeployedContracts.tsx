import * as React from 'react';
import type { GetStaticProps } from 'next';
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
import { DataTable } from '@/components/ui/DataTable/DataTable';
import {
  columns as proxyContractsColumns,
  proxyColumnsTitles,
} from '@/components/DeployedContracts/proxyContractsColumns';
import { ContractItemWrapper } from '@/components/sol-contracts/ContractItemWrapper';
import { CoreContractCard } from '@/components/DeployedContracts/CoreContractCard';
import { dataFeedUrl } from '@/src/constants';
import { NetworkIcon } from '@/components/DeployedContracts/NetworkIcon';
import { Callout } from '@blocksense/docs-theme';

export const getStaticProps = (() => {
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
    props: { parsedCoreContracts, parsedProxyContracts },
    revalidate: false,
  };
}) satisfies GetStaticProps<{
  parsedCoreContracts: CoreContract[];
  parsedProxyContracts: ProxyContractData[];
}>;

type FeedsDataProps = {
  parsedCoreContracts: CoreContract[];
  parsedProxyContracts: ProxyContractData[];
};

export const DeployedContracts = ({
  parsedCoreContracts: deployedCoreContracts,
  parsedProxyContracts: deployedProxyContracts,
}: FeedsDataProps) => {
  const [selectedNetwork, setSelectedNetwork] = React.useState<string | null>(
    null,
  );
  const contractsRef = React.useRef<HTMLDivElement | null>(null);

  const handleNetworkClick = (network: string) => {
    setSelectedNetwork(network);
    history.pushState(null, '', `?network=${network}`);
    setTimeout(() => {
      contractsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  };

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const networkFromUrl = urlParams.get('network');
    const isValidNetwork =
      networkFromUrl &&
      deployedCoreContracts[0].networks.some(n => n === networkFromUrl);

    if (isValidNetwork) {
      setSelectedNetwork(networkFromUrl);
      contractsRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      if (networkFromUrl) window.location.href = '/404';
    }
  }, [deployedCoreContracts]);

  const smartContractsUrl = './#smart-contract-architecture';

  return (
    <section className="mt-4">
      <ContractItemWrapper
        title="Supported Networks"
        titleLevel={2}
        itemsLength={1}
      >
        <Callout type="info" emoji="💡">
          <span className="text-gray-500 text-md">
            We have deployed our contracts on the following networks. Select a
            network to view detailed information about the deployed contracts.
          </span>
        </Callout>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {deployedCoreContracts[0].networks.map(network => (
            <NetworkIcon
              key={network}
              network={network}
              isSelected={selectedNetwork === network}
              onClick={() => {
                handleNetworkClick(network);
              }}
            />
          ))}
        </div>
      </ContractItemWrapper>
      {selectedNetwork && (
        <div ref={contractsRef}>
          <ContractItemWrapper
            title="Core Contracts"
            titleLevel={2}
            itemsLength={deployedCoreContracts.length}
          >
            <Callout type="info" emoji="💡">
              <span className="text-gray-500 text-md">
                These contracts are key components of the Blocksense platform
                and provide essential functionalities that support the
                ecosystem.
                <br />
                Discover more into our smart contracts
                <a
                  href={smartContractsUrl}
                  className="nx-text-primary-600 nx-underline nx-decoration-from-font [text-underline-position:from-font] mx-1"
                >
                  architecture
                </a>
                documentation section.
              </span>
            </Callout>
            <div className="container px-0">
              {deployedCoreContracts.map(contract => (
                <CoreContractCard
                  key={contract.address}
                  contract={{
                    name: contract.contract,
                    address: contract.address,
                    networks: contract.networks.filter(
                      network => network === parseNetworkName(selectedNetwork),
                    ),
                  }}
                />
              ))}
            </div>
          </ContractItemWrapper>
          <div className="mt-6">
            <ContractItemWrapper
              title="Aggregator Proxy Contracts"
              titleLevel={2}
              itemsLength={deployedProxyContracts.length}
            >
              <Callout type="info" emoji="💡">
                <span className="text-gray-500 text-md">
                  Blocksense aggregator proxy contracts table allows users to
                  explore contracts that serve as an alternative to the
                  Chainlink proxy contracts. Additionally, the table provides
                  information about data feed names, IDs, and relevant
                  addresses.
                </span>
              </Callout>
              <DataTable
                columns={proxyContractsColumns}
                data={deployedProxyContracts.filter(
                  element =>
                    element.network === parseNetworkName(selectedNetwork),
                )}
                columnsTitles={proxyColumnsTitles}
                filterCell="description"
                rowLink={dataFeedUrl}
              />
            </ContractItemWrapper>
          </div>
        </div>
      )}
    </section>
  );
};
