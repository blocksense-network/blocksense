'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Callout } from '@blocksense/ui/Callout';
import {
  isNetwork,
  NetworkName,
  parseNetworkName,
} from '@blocksense/base-utils/evm';

import { capitalizeWords } from '@/src/utils';
import {
  CoreContract,
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
import { all } from 'effect/Equivalence';

type DeployedContractsProps = {
  coreContracts: CoreContract[];
  proxyContracts: ProxyContractData[];
};

export const DeployedContracts = ({
  coreContracts,
  proxyContracts: allProxyContracts,
}: DeployedContractsProps) => {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkName | null>(
    null,
  );
  const proxyContracts = useMemo(
    () => allProxyContracts.filter(c => c.network === selectedNetwork),
    [selectedNetwork, allProxyContracts],
  );
  const contractsRef = useRef<HTMLDivElement | null>(null);
  const { hash, setNewHash } = useHash();

  useEffect(() => {
    const networkFromHash = hash.replace('#', '');
    if (!isNetwork(networkFromHash)) {
      setSelectedNetwork(null);
      return;
    }

    const network =
      networkFromHash &&
      coreContracts[0].networks.find(n => n === networkFromHash);

    if (network) {
      setSelectedNetwork(network);
      setTimeout(() => {
        contractsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    } else {
      setSelectedNetwork(null);
    }
  }, [coreContracts, hash]);

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
          {coreContracts[0].networks.map(network => (
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
            itemsLength={coreContracts.length}
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
              {coreContracts.map(contract => (
                <CoreContractCard
                  key={contract.address}
                  name={contract.contract}
                  address={contract.address}
                  network={selectedNetwork}
                />
              ))}
            </div>
          </ContractItemWrapper>
          <div className="mt-6">
            <ContractItemWrapper
              title="Chainlink Aggregator Adapter Contracts"
              titleLevel={2}
              itemsLength={0}
            >
              <Callout type="info" emoji="💡">
                Blocksense aggregator proxy contracts table allows users to
                explore contracts that serve as an alternative to the Chainlink
                proxy contracts. Additionally, the table provides information
                about data feed names, IDs, and relevant addresses.
              </Callout>

              <div className="pt-2 text-2xl text-center font-semibold text-black leading-none tracking-tight dark:text-white">
                {capitalizeWords(selectedNetwork)}
              </div>
              <DataTable
                columns={proxyContractsColumns}
                data={proxyContracts}
                filterCell="description"
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
