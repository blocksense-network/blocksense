'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Callout } from '@blocksense/docs-ui/Callout';
import {
  NetworkName,
  isNetworkName,
} from '@blocksense/base-utils/evm/networks';

import { capitalizeWords } from '@/src/utils';
import { DataTable } from '@/components/common/DataTable/DataTable';
import { ContractItemWrapper } from '@/components/sol-contracts/ContractItemWrapper';
import { CoreContractCard } from '@/components/DeployedContracts/CoreContractCard';
import { NetworkIcon } from '@/components/DeployedContracts/NetworkIcon';
import { dataFeedUrl } from '@/src/constants';
import { useHash } from '@/hooks/useHash';
import {
  cellHaveContent,
  DataRowType,
} from '../common/DataTable/dataTableUtils';
import { DeploymentConfigV2 } from '@blocksense/config-types';
import { entriesOf, keysOf } from '@blocksense/base-utils/array-iter';
import { DataTableBadge } from '../common/DataTable/DataTableBadge';
import { DataTableColumnHeader } from '../common/DataTable/DataTableColumnHeader';
import { ContractAddress } from '../sol-contracts/ContractAddress';

type DeployedContractsProps = {
  networks: NetworkName[];
  deploymentInfo: Record<NetworkName, DeploymentConfigV2>;
};

export const DeployedContracts = ({
  networks,
  deploymentInfo,
}: DeployedContractsProps) => {
  const [selectedNetwork, setSelectedNet] = useState<NetworkName | null>(null);
  const contractsRef = useRef<HTMLDivElement | null>(null);
  const { hash, setNewHash } = useHash();

  useEffect(() => {
    const network = hash.replace('#', '');
    if (!isNetworkName(network)) {
      setSelectedNet(null);
      return;
    }

    setSelectedNet(network);
    setTimeout(() => {
      contractsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }, [hash]);

  const networkInfo = selectedNetwork ? deploymentInfo[selectedNetwork] : null;

  const proxyContracts = useMemo(() => {
    if (!networkInfo) return [];
    return Object.entries(networkInfo.contracts.CLAggregatorAdapter).map(
      ([feedId, { address, constructorArgs }]) => ({
        feedId,
        name: constructorArgs[0],
        address,
      }),
    );
  }, [networkInfo]);

  function getRowLink(row: DataRowType) {
    return dataFeedUrl && cellHaveContent(row.feedId)
      ? `${dataFeedUrl}${row.feedId}${hash}`
      : '';
  }

  return (
    <section className="mt-4">
      <ContractItemWrapper title="Supported Networks" titleLevel={2} nonEmpty>
        <Callout type="info" emoji="💡">
          We have deployed our contracts on the following networks. Select a
          network to view detailed information about the deployed contracts.
        </Callout>
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {networks.map(network => (
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
      {selectedNetwork && networkInfo && (
        <div ref={contractsRef}>
          <ContractItemWrapper
            title="Core Contracts"
            titleLevel={2}
            nonEmpty={true}
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
              {entriesOf(networkInfo.contracts.coreContracts).map(
                ([name, { address }]) => (
                  <CoreContractCard
                    key={address}
                    contract={{
                      name,
                      address,
                      network: selectedNetwork,
                    }}
                  />
                ),
              )}
            </div>
          </ContractItemWrapper>
          <div className="mt-6">
            <ContractItemWrapper
              title="Chainlink Aggregator Adapter Contracts"
              titleLevel={2}
              nonEmpty={
                !!keysOf(networkInfo.contracts.CLAggregatorAdapter).length
              }
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
                columns={[
                  {
                    id: 'id',
                    title: 'Id',
                    header: ({ column }) => (
                      <DataTableColumnHeader title={column.title} />
                    ),
                    cell: ({ row }) => (
                      <DataTableBadge>{row.feedId}</DataTableBadge>
                    ),
                  },
                  {
                    id: 'name',
                    title: 'Data Feed',
                    header: ({ column }) => (
                      <DataTableColumnHeader title={column.title} />
                    ),
                    cell: ({ row }) => (
                      <DataTableBadge>{row.name}</DataTableBadge>
                    ),
                  },
                  {
                    id: 'address',
                    title: 'CL Aggregator Adapter',
                    header: ({ column }) => (
                      <DataTableColumnHeader title={column.title} />
                    ),
                    cell: ({ row }) => (
                      <ContractAddress
                        network={selectedNetwork}
                        address={row.address}
                        copyButton={{ enableCopy: true, background: false }}
                        abbreviation={{ hasAbbreviation: false }}
                      />
                    ),
                  },
                ]}
                data={proxyContracts}
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
