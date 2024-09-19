import * as React from 'react';
import Link from 'next/link';

import { ColumnDef, Row } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';

type DataFeed = {
  id: number;
  description: string;
  decimals: number;
  report_interval_ms: number;
  script: string;
};

export const dataFeedsColumnsTitles = {
  id: 'Id',
  description: 'Data Feed Name',
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
        title={dataFeedsColumnsTitles['id']}
        type={'number'}
      />
    ),
    cell: ({ row }) => (
      <strong>
        <DataFeedLink row={row} placeholderId="id" />
      </strong>
    ),
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles['description']}
        type={'string'}
      />
    ),
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className="border-solid border-slate-200 cursor-pointer m-0 text-primary-600 bold font-medium whitespace-nowrap"
      >
        <DataFeedLink row={row} placeholderId="description" />
      </Badge>
    ),
  },
  {
    accessorKey: 'decimals',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles['decimals']}
        type={'number'}
      />
    ),
  },
  {
    accessorKey: 'report_interval_ms',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles['report_interval_ms']}
        type={'number'}
      />
    ),
  },
  {
    accessorKey: 'script',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles['script']}
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

type DataFeedLinkProps = {
  row: Row<DataFeed>;
  placeholderId: string;
};

const DataFeedLink = ({ row, placeholderId }: DataFeedLinkProps) => {
  return (
    <Link href={`feed/${row.getValue('id')}`}>
      {row.getValue(placeholderId)}
    </Link>
  );
};
