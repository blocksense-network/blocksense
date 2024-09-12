import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { ColumnDef, Row } from '@tanstack/react-table';

import { previewHexStringOrDefault } from '@/src/utils';
import { ProxyContractData } from '@/src/deployed-contracts/types';
import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { Badge } from '@/components/ui/badge';
import {
  EthereumAddress,
  explorerAddressUrls,
  isEthereumAddress,
} from '@blocksense/base-utils/evm-utils';

export const proxyColumnsTitles = {
  network: 'Network',
  id: 'ID',
  description: 'Data Feed Name',
  address: 'Blocksense Proxy address',
  base: 'Base Address',
  quote: 'Quote Address',
  chainlink_proxy: 'CL Aggregator Proxy address',
};

export const columns: ColumnDef<ProxyContractData>[] = [
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['description']}
        type={'string'}
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
      />
    ),
    cell: ({ row }) => (
      <AddressExplorerLink row={row} placeholderId="address" />
    ),
  },
  {
    accessorKey: 'base',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['base']}
        type={'string'}
      />
    ),
    cell: ({ row }) => <AddressExplorerLink row={row} placeholderId="base" />,
  },
  {
    accessorKey: 'quote',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['quote']}
        type={'string'}
      />
    ),
    cell: ({ row }) => <AddressExplorerLink row={row} placeholderId="quote" />,
  },
  {
    accessorKey: 'chainlink_proxy',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles['chainlink_proxy']}
        type={'string'}
      />
    ),
    cell: ({ row }) => (
      <AddressExplorerLink row={row} placeholderId="chainlink_proxy" />
    ),
  },
  {
    accessorKey: 'network',
    header: ({ column }) => null,
    cell: ({ row }) => null,
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
      className={`border-solid border-slate-200 ${placeholderValue && 'cursor-pointer'} m-0 text-primary-600 bold font-medium whitespace-nowrap`}
    >
      {placeholderValue ? (
        <Link href={feedPageUrl}>{row.getValue(placeholderId!)}</Link>
      ) : (
        '-'
      )}
    </Badge>
  );
};

const AddressExplorerLink = ({ row, placeholderId }: RowWrapper) => {
  const address = row.getValue(placeholderId!);
  if (!address) {
    return '-';
  }
  if (!isEthereumAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  const network = row.original.network;
  return (
    <code>
      <Link href={explorerAddressUrls[network](address as EthereumAddress)}>
        {previewHexStringOrDefault(address)}
      </Link>
    </code>
  );
};
