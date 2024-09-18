import * as React from 'react';

import {
  DataTable,
  getFacetedFilters,
} from '@/components/ui/DataTable/DataTable';
import {
  columns as coreContractsColumns,
  contractsColumnsTitles,
} from '@/components/DeployedContracts/coreContractsColumns';
import {
  columns as proxyContractsColumns,
  proxyColumnsTitles,
} from '@/components/DeployedContracts/proxyContractsColumns';
import { ContractItemWrapper } from '@/components/sol-contracts/ContractItemWrapper';
import {
  decodeCoreContracts,
  decodeProxyContracts,
} from '@/src/deployed-contracts/types';

type DeployedContractsProps = {
  deployedCoreContractsString: string;
  deployedProxyContractsString: string;
};

export const DeployedContracts = ({
  deployedCoreContractsString,
  deployedProxyContractsString,
}: DeployedContractsProps) => {
  const deployedContracts = decodeCoreContracts(
    JSON.parse(deployedCoreContractsString),
  );

  const deployedProxyContracts = decodeProxyContracts(
    JSON.parse(deployedProxyContractsString),
  );

  const filters = React.useMemo(
    () =>
      getFacetedFilters(
        ['network', 'description'],
        deployedProxyContracts,
        proxyColumnsTitles,
      ),
    [deployedProxyContracts],
  );

  const smartContractsUrl = './#smart-contract-architecture';

  return (
    <section className="mt-4">
      <ContractItemWrapper
        title="Core Contracts"
        titleLevel={2}
        itemsLength={deployedContracts.length}
      >
        <article className="mt-4 mb-6">
          <span className="text-gray-500 text-md">
            Explore the deployed core contracts, including their addresses and
            networks where they are available. These contracts are key
            components of the Blocksense platform and provide essential
            functionalities that support the ecosystem.
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
        <DataTable
          hasToolbar={false}
          columns={coreContractsColumns}
          data={deployedContracts}
          columnsTitles={contractsColumnsTitles}
        />
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
              explore contracts that serve as an alternative to the Chainlink
              proxy contracts. Additionally, the table provides information
              about data feed names, IDs, and relevant addresses.
            </span>
          </article>
          <DataTable
            columns={proxyContractsColumns}
            data={deployedProxyContracts}
            columnsTitles={proxyColumnsTitles}
            filters={filters}
          />
        </ContractItemWrapper>
      </div>
    </section>
  );
};
