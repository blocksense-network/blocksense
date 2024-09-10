import * as React from 'react';

import { ColumnDef } from '@tanstack/react-table';

import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { previewHexStringOrDefault } from '@/src/utils';

type SupportedNetwork = {
  network: string;
  description?: string;
  address: string;
  base?: string;
  quote?: string;
  chainlink_proxy?: string;
};

export const networksColumnsTitles = {
  network: 'Network',
  description: 'Description',
  address: 'Address',
  base: 'Base',
  quote: 'Quote',
  chainlink_proxy: 'Chainlink Proxy',
};

export const columns: ColumnDef<SupportedNetwork>[] = [
  {
    accessorKey: 'network',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={networksColumnsTitles['network']}
        type={'string'}
      />
    ),
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={networksColumnsTitles['description']}
        type={'string'}
      />
    ),
  },
  {
    accessorKey: 'address',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={networksColumnsTitles['address']}
        type={'string'}
      />
    ),
    cell: ({ row }) => previewHexStringOrDefault(row.getValue('address')),
  },
  {
    accessorKey: 'base',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={networksColumnsTitles['base']}
        type={'string'}
      />
    ),
    cell: ({ row }) => previewHexStringOrDefault(row.getValue('base')),
  },
  {
    accessorKey: 'quote',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={networksColumnsTitles['quote']}
        type={'string'}
      />
    ),
    cell: ({ row }) => previewHexStringOrDefault(row.getValue('quote')),
  },
  {
    accessorKey: 'chainlink_proxy',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={networksColumnsTitles['chainlink_proxy']}
        type={'string'}
      />
    ),
    cell: ({ row }) =>
      previewHexStringOrDefault(row.getValue('chainlink_proxy')),
  },
];
