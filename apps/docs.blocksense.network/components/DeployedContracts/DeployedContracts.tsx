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

  return (
    <div>
      <ContractItemWrapper
        title="Core Contracts"
        titleLevel={2}
        itemsLength={deployedContracts.length}
      >
        <DataTable
          hasToolbar={false}
          columns={coreContractsColumns}
          data={deployedContracts}
          columnsTitles={contractsColumnsTitles}
        />
      </ContractItemWrapper>

      <div className="mt-10">
        <ContractItemWrapper
          title="Aggregator Proxy Contracts"
          titleLevel={2}
          itemsLength={deployedProxyContracts.length}
        >
          <DataTable
            columns={proxyContractsColumns}
            data={deployedProxyContracts}
            columnsTitles={proxyColumnsTitles}
            filters={filters}
          />
        </ContractItemWrapper>
      </div>
    </div>
  );
};
