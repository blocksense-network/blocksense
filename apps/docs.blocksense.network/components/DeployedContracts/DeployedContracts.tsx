import * as React from 'react';

import { parseNetworkName } from '@blocksense/base-utils/evm';

import { DataTable } from '@/components/ui/DataTable/DataTable';
import {
  columns as proxyContractsColumns,
  proxyColumnsTitles,
} from '@/components/DeployedContracts/proxyContractsColumns';
import { ContractItemWrapper } from '@/components/sol-contracts/ContractItemWrapper';
import { CoreContractCard } from '@/components/DeployedContracts/CoreContractCard';
import {
  decodeCoreContracts,
  decodeProxyContracts,
} from '@/src/deployed-contracts/types';
import { dataFeedUrl } from '@/src/constants';
import { NetworkIcon } from '@/components/DeployedContracts/NetworkIcon';

type DeployedContractsProps = {
  deployedCoreContractsString: string;
  deployedProxyContractsString: string;
};

export const DeployedContracts = ({
  deployedCoreContractsString,
  deployedProxyContractsString,
}: DeployedContractsProps) => {
  const deployedCoreContracts = decodeCoreContracts(
    JSON.parse(deployedCoreContractsString),
  );
  const deployedProxyContracts = decodeProxyContracts(
    JSON.parse(deployedProxyContractsString),
  );

  const [selectedNetwork, setSelectedNetwork] = React.useState<string | null>(
    null,
  );
  const contractsRef = React.useRef<HTMLDivElement | null>(null);

  const handleNetworkClick = (network: string) => {
    setSelectedNetwork(network);
    setTimeout(() => {
      contractsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  };

  const smartContractsUrl = './#smart-contract-architecture';

  return (
    <section className="mt-4">
      <ContractItemWrapper
        title="Supported Networks"
        titleLevel={2}
        itemsLength={1}
      >
        <article className="mt-4 mb-6">
          <span className="text-gray-500 text-md">
            We have deployed our contracts on the following networks. Select a
            network to view detailed information about the deployed contracts.
            <br />
          </span>
        </article>

        <div className="flex flex-wrap justify-center gap-4 pt-3">
          {deployedCoreContracts[0].networks.map(network => (
            <NetworkIcon
              key={network}
              network={network}
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
            <article className="mt-4 mb-6">
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
            </article>
            <div className="container px-0">
              {deployedCoreContracts.map(contract => (
                <CoreContractCard
                  key={contract.address}
                  contract={{
                    name: contract.contract,
                    address: contract.address,
                    networks: selectedNetwork
                      ? contract.networks.filter(
                          network =>
                            network == parseNetworkName(selectedNetwork),
                        )
                      : contract.networks,
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
              <article className="mt-4 mb-6">
                <span className="text-gray-500 text-md">
                  Blocksense aggregator proxy contracts table allows users to
                  explore contracts that serve as an alternative to the
                  Chainlink proxy contracts. Additionally, the table provides
                  information about data feed names, IDs, and relevant
                  addresses.
                </span>
              </article>
              <DataTable
                columns={proxyContractsColumns}
                data={deployedProxyContracts.filter(
                  element => element.network === selectedNetwork,
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
