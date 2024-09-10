import * as React from 'react';

import {
  DataTable,
  getFacetedFilters,
} from '@/components/ui/DataTable/DataTable';
import {
  contractsColumnsTitles,
  columns,
} from '@/components/SupportedContracts/columns';
import { ContractItemWrapper } from '@/components/sol-contracts/ContractItemWrapper';
import networksData from '../../supported-networks-mock.json';

export const SupportedContracts = () => {
  const structureSupportedContracts = React.useCallback(() => {
    const supportedContracts = Object.entries(networksData)
      .map(([_, network]) => {
        const { name, contracts } = network;
        const { coreContracts, ChainlinkProxy, ...restOfContracts } = contracts;

        const allContracts = { ...coreContracts, ...restOfContracts };

        return Object.entries(allContracts).map(([contract, address]) => ({
          network: name,
          contract,
          address,
        }));
      })
      .flat();
    return supportedContracts;
  }, [networksData]);

  const supportedContracts = React.useMemo(
    () => structureSupportedContracts(),
    [networksData],
  );

  const filters = React.useMemo(
    () =>
      getFacetedFilters(
        ['network', 'contract'],
        supportedContracts,
        contractsColumnsTitles,
      ),
    [supportedContracts],
  );

  return (
    <ContractItemWrapper
      title="Supported Contracts"
      titleLevel={2}
      itemsLength={supportedContracts.length}
    >
      <DataTable
        columns={columns}
        data={supportedContracts}
        filterCell="network"
        columnsTitles={contractsColumnsTitles}
        filters={filters}
      />
    </ContractItemWrapper>
  );
};
