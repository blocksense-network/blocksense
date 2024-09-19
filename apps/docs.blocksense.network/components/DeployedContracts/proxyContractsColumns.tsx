import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { ColumnDef, Row } from '@tanstack/react-table';

import { ProxyContractData } from '@/src/deployed-contracts/types';
import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { Badge } from '@/components/ui/badge';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';

export const proxyColumnsTitles = {
  network: 'Network',
  id: 'ID',
  description: 'Data Feed Name',
  address: 'Blocksense Proxy Address',
  base: 'Base Address',
  quote: 'Quote Address',
  chainlink_proxy: 'CL Aggregator Proxy Address',
};

export const columns: ColumnDef<ProxyContractData>[] = [
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['description']}
        type={'string'}
        hasSort={false}
      />
    ),
    cell: ({ row }) => <DataFeedLink row={row} placeholderId="description" />,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['id']}
        type={'number'}
        hasSort={false}
      />
    ),
    cell: ({ row }) => <DataFeedLink row={row} placeholderId="id" />,
  },
  {
    accessorKey: 'address',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['address']}
        type={'string'}
        hasSort={false}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress
        network={row.original.network}
        address={row.getValue('address')}
        enableCopy
        hasAbbreviation
      />
    ),
  },
  {
    accessorKey: 'base',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['base']}
        type={'string'}
        hasSort={false}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress
        network={row.original.network}
        address={row.getValue('base')}
        enableCopy
        hasAbbreviation
      />
    ),
  },
  {
    accessorKey: 'quote',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['quote']}
        type={'string'}
        hasSort={false}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress
        network={row.original.network}
        address={row.getValue('quote')}
        enableCopy
        hasAbbreviation
      />
    ),
  },
  {
    accessorKey: 'chainlink_proxy',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['chainlink_proxy']}
        type={'string'}
        hasSort={false}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress
        network={row.original.network}
        address={row.getValue('chainlink_proxy')}
        enableCopy
        hasAbbreviation
      />
    ),
  },
  {
    accessorKey: 'network',
  },
];

type RowWrapper = {
  row: Row<ProxyContractData>;
  placeholderId: string;
};

const DataFeedLink = ({ row, placeholderId }: RowWrapper) => {
  const feedId = row.original.id;
  const router = useRouter();
  const feedPageUrl = `${router.basePath}/docs/data-feeds/feed/${feedId}`;

  const placeholderValue = row.getValue(placeholderId!);
  return (
    <Badge
      variant="outline"
      className={`justify-center border-solid border-slate-200 ${placeholderValue && 'cursor-pointer'} m-0 text-primary-600 bold font-medium whitespace-nowrap hover:bg-neutral-50 hover:border-gray-600`}
    >
      {placeholderValue ? (
        <Link href={feedPageUrl}>{row.getValue(placeholderId!)}</Link>
      ) : (
        '-'
      )}
    </Badge>
  );
};
