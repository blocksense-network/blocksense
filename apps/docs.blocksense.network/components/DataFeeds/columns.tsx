import * as React from 'react';

import { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';

export type DataFeed = {
  id: string;
  description: string;
  decimals: number;
  report_interval_ms: number;
  script: string;
};

export const columnTitles = {
  id: 'Id',
  description: 'Description',
  decimals: 'Decimals',
  report_interval_ms: 'Refresh Interval (ms)',
  script: 'Data Sources',
};

export const columns: ColumnDef<DataFeed>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={columnTitles['id']}
        type={'number'}
      />
    ),
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={columnTitles['description']}
        type={'string'}
      />
    ),
  },
  {
    accessorKey: 'decimals',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={columnTitles['decimals']}
        type={'number'}
      />
    ),
  },
  {
    accessorKey: 'report_interval_ms',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={columnTitles['report_interval_ms']}
        type={'number'}
      />
    ),
  },
  {
    accessorKey: 'script',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={columnTitles['script']}
        type={'string'}
      />
    ),
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className="border-solid border-slate-200 cursor-pointer m-0 text-primary-600 bold font-medium"
      >
        {row.getValue('script')}
      </Badge>
    ),
  },
];
