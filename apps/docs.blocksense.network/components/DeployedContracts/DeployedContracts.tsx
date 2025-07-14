'use client';

import { useEffect, useRef, useState } from 'react';

import { Callout } from '@blocksense/docs-ui/Callout';
import { parseNetworkName } from '@blocksense/base-utils/evm/networks';

import { capitalizeWords } from '@/src/utils';
import {
  CoreContractsDataAndNetworks,
  ProxyContractData,
} from '@/src/deployed-contracts/types';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { columns as proxyContractsColumns } from '@/components/DeployedContracts/proxyContractsColumns';
import { ContractItemWrapper } from '@/components/sol-contracts/ContractItemWrapper';
import { CoreContractCard } from '@/components/DeployedContracts/CoreContractCard';
import { NetworkIcon } from '@/components/DeployedContracts/NetworkIcon';
import { dataFeedUrl } from '@/src/constants';
import { useHash } from '@/hooks/useHash';
import {
  cellHaveContent,
  DataRowType,
} from '../common/DataTable/dataTableUtils';

type DeployedContractsProps = {
  parsedCoreContracts: CoreContractsDataAndNetworks;
  parsedProxyContracts: ProxyContractData[];
};

export const DeployedContracts = ({
  parsedCoreContracts: deployedCoreContracts,
  parsedProxyContracts: deployedProxyContracts,
}: DeployedContractsProps) => {
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const contractsRef = useRef<HTMLDivElement | null>(null);
  const { hash, setNewHash } = useHash();

  useEffect(() => {
    const networkFromHash = hash.replace('#', '');
    if (!networkFromHash) {
      setSelectedNetwork('');
      return;
    }

    const network = networkFromHash;

    if (network) {
      setSelectedNetwork(network);
      setTimeout(() => {
        contractsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    } else {
      setSelectedNetwork('');
    }
  }, [deployedCoreContracts, hash]);

  function getRowLink(row: DataRowType) {
    return dataFeedUrl && cellHaveContent(row.id)
      ? `${dataFeedUrl}${row.id}${hash}`
      : '';
  }

  return (
    <section className="mt-4">
      <ContractItemWrapper
        title="Supported Networks"
        titleLevel={2}
        itemsLength={1}
      >
        <Callout type="info" emoji="💡">
          We have deployed our contracts on the following networks. Select a
          network to view detailed information about the deployed contracts.
        </Callout>
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {deployedCoreContracts.networks.map(network => (
            <NetworkIcon
              key={network}
              network={network}
              isSelected={selectedNetwork === network}
              onClick={() => {
                setNewHash(`#${network}`);
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
            itemsLength={deployedCoreContracts.contracts.length}
          >
            <Callout type="info" emoji="💡">
              <span>
                These contracts are key components of the Blocksense platform
                and provide essential functionalities that support the
                ecosystem.
                <br />
                Discover more into our smart contracts
                <a
                  href={'./#smart-contract-architecture'}
                  className="nx-text-primary-600 nx-underline nx-decoration-from-font [text-underline-position:from-font] mx-1"
                >
                  architecture
                </a>
                documentation section.
              </span>
            </Callout>
            <div className="container px-0">
              {deployedCoreContracts.contracts
                .filter(c => c !== undefined)
                .filter(c => c.network === parseNetworkName(selectedNetwork))[0]
                .contracts.map(contract => (
                  <CoreContractCard
                    key={contract.address}
                    contract={{
                      name: contract.contract,
                      address: contract.address,
                      network: parseNetworkName(selectedNetwork),
                    }}
                  />
                ))}
            </div>
          </ContractItemWrapper>
          <div className="mt-6">
            <ContractItemWrapper
              title="Chainlink Aggregator Adapter Contracts"
              titleLevel={2}
              itemsLength={deployedProxyContracts.length}
            >
              <Callout type="info" emoji="💡">
                Blocksense aggregator proxy contracts table allows users to
                explore contracts that serve as an alternative to the Chainlink
                proxy contracts. Additionally, the table provides information
                about data feed names, IDs, and relevant addresses.
              </Callout>

              <div className="pt-2 text-2xl text-center font-semibold text-black leading-none tracking-tight dark:text-white">
                {`${capitalizeWords(selectedNetwork)}`}
              </div>
              <DataTable
                columns={proxyContractsColumns}
                data={deployedProxyContracts.filter(
                  element =>
                    element.network === parseNetworkName(selectedNetwork),
                )}
                filterCell="name"
                getRowLink={getRowLink}
                hasToolbar
              />
            </ContractItemWrapper>
          </div>
        </div>
      )}
    </section>
  );
};
