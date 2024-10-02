import * as React from 'react';

import { ColumnDef } from '@tanstack/react-table';

import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { CoreContract } from '@/src/deployed-contracts/types';
import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { NetworkAddressExplorerLink } from '@/components/DeployedContracts/NetworkAddressExplorerLink';

export const contractsColumnsTitles: { [key: string]: string } = {
  network: 'Network',
  contract: 'Contract',
  address: 'Address',
};

export const columns: ColumnDef<CoreContract>[] = [
  {
    accessorKey: 'contract',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={contractsColumnsTitles[column.id]}
      />
    ),
  },
  {
    accessorKey: 'address',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={contractsColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress address={row.getValue('address')} enableCopy />
    ),
  },
  {
    accessorKey: 'network',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={contractsColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => (
      <NetworkAddressExplorerLink
        address={row.original.address}
        networks={row.original.networks}
      />
    ),
  },
];
