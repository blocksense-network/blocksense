import * as React from 'react';
import Link from 'next/link';

import { ColumnDef } from '@tanstack/react-table';

import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';

type DataFeed = {
  id: number;
  description: string;
  decimals: number;
  report_interval_ms: number;
  script: string;
};

export const dataFeedsColumnsTitles: { [key: string]: string } = {
  id: 'Id',
  description: 'Data Feed Name',
  decimals: 'Decimals',
  report_interval_ms: 'Refresh Interval (ms)',
  script: 'Data Sources',
};

export const dataSourcesLinks: { [key: string]: string } = {
  CoinMarketCap: 'https://coinmarketcap.com/',
  YahooFinance: 'https://finance.yahoo.com/',
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
  {
    accessorKey: 'script',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={dataFeedsColumnsTitles[column.id]}
        sortingType={'string'}
      />
    ),
    cell: ({ row }) => {
      const dataSourceLink =
        dataSourcesLinks[row.getValue('script') as string] || '';

      function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        e.stopPropagation();
        if (dataSourceLink) {
          window.open(dataSourceLink);
        }
      }

      return (
        <DataTableBadge>
          <Link
            href={dataSourceLink}
            onClick={onLinkClick}
            onAuxClick={onLinkClick}
          >
            {row.getValue('script')}
          </Link>
        </DataTableBadge>
      );
    },
  },
];
