import * as React from 'react';

import { ColumnDef } from '@tanstack/react-table';

import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';

type DataFeed = {
  id: number;
  description: string;
  decimals: number;
  report_interval_ms: number;
};

export const dataFeedsColumnsTitles: { [key: string]: string } = {
  id: 'Id',
  description: 'Data Feed Name',
  decimals: 'Decimals',
  report_interval_ms: 'Refresh Interval (ms)',
};

export const columns: ColumnDef<DataFeed>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles[column.id]}
        sortingType={'number'}
      />
    ),
    cell: ({ row }) => <DataTableBadge>{row.getValue('id')}</DataTableBadge>,
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles[column.id]}
        sortingType={'string'}
      />
    ),
    cell: ({ row }) => (
      <DataTableBadge>{row.getValue('description')}</DataTableBadge>
    ),
  },
  {
    accessorKey: 'decimals',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles[column.id]}
        sortingType={'number'}
      />
    ),
  },
  {
    accessorKey: 'report_interval_ms',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles[column.id]}
        sortingType={'number'}
      />
    ),
  },
];
