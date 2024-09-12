import * as React from 'react';
import Link from 'next/link';

import { ColumnDef, Row } from '@tanstack/react-table';

import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { CoreContract } from '@/src/deployed-contracts/types';

import { Badge } from '../ui/badge';
import {
  EthereumAddress,
  explorerAddressUrls,
  NetworkName,
} from '@blocksense/base-utils/evm-utils';

export const contractsColumnsTitles = {
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
  {
    accessorKey: 'network',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={contractsColumnsTitles['network']}
        type={'string'}
      />
    ),
    cell: ({ row }) => <NetworksWithLinks row={row} />,
  },
];

type RowWrapper = {
  row: Row<CoreContract>;
};

const NetworksWithLinks = ({ row }: RowWrapper) => {
  const address = row.original.address;
  return (
    <div>
      {row.original.networks.map((network: NetworkName) => (
        <Badge
          key={network}
          variant="outline"
          className="border-solid border-slate-200 cursor-pointer m-0 text-primary-600 bold font-medium m-1"
        >
          <Link href={explorerAddressUrls[network](address as EthereumAddress)}>
            {network}
          </Link>
        </Badge>
      ))}
    </div>
  );
};
