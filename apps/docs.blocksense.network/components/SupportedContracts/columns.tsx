import * as React from 'react';

import { ColumnDef } from '@tanstack/react-table';

import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';

type SupportedNetwork = {
  network: string;
  contract: string;
  address: string;
};

export const contractsColumnsTitles = {
  network: 'Network',
  contract: 'Contract',
  address: 'Address',
};

export const columns: ColumnDef<SupportedNetwork>[] = [
  {
    accessorKey: 'network',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={contractsColumnsTitles['network']}
        type={'string'}
      />
    ),
  },
  {
    accessorKey: 'contract',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={contractsColumnsTitles['contract']}
        type={'string'}
      />
    ),
  },
  {
    accessorKey: 'address',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={contractsColumnsTitles['address']}
        type={'string'}
      />
    ),
  },
];
