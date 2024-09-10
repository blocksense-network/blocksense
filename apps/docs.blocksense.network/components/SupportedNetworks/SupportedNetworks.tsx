import * as React from 'react';

import {
  DataTable,
  getFacetedFilters,
} from '@/components/ui/DataTable/DataTable';
import {
  columns,
  networksColumnsTitles,
} from '@/components/SupportedNetworks/columns';
import { ContractItemWrapper } from '@/components/sol-contracts/ContractItemWrapper';
import networksData from '../../supported-networks-mock.json';

export const SupportedNetworks = () => {
  const structureSupportedNetworks = React.useCallback(() => {
    const supportedNetworks = Object.entries(networksData)
      .map(([_, network]) => {
        const { name, contracts } = network;
        const { ChainlinkProxy } = contracts;

        return ChainlinkProxy.map(proxy => ({
          ...proxy,
          network: name,
        }));
      })
      .flat();
    return supportedNetworks;
  }, [networksData]);

  const supportedNetworks = React.useMemo(
    () => structureSupportedNetworks(),
    [networksData],
  );

  const filters = React.useMemo(
    () =>
      getFacetedFilters(
        ['network', 'description'],
        supportedNetworks,
        networksColumnsTitles,
      ),
    [supportedNetworks],
  );

  return (
    <ContractItemWrapper
      title="Supported Networks"
      titleLevel={2}
      itemsLength={supportedNetworks.length}
    >
      <DataTable
        columns={columns}
        data={supportedNetworks}
        filterCell="network"
        columnsTitles={networksColumnsTitles}
        filters={filters}
      />
    </ContractItemWrapper>
  );
};
