import * as React from 'react';
import Link from 'next/link';

import { ColumnDef, Row } from '@tanstack/react-table';

import {
  getAddressExplorerUrl,
  NetworkName,
} from '@blocksense/base-utils/evm-utils';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { CoreContract } from '@/src/deployed-contracts/types';
import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';

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
    cell: ({ row }) => <NetworkAddressExplorerLink row={row} />,
  },
];

type RowWrapper = {
  row: Row<CoreContract>;
};

const NetworkAddressExplorerLink = ({ row }: RowWrapper) => {
  const address = row.original.address;
  return (
    <aside className="space-y-1">
      {row.original.networks.map((network: NetworkName) => (
        <DataTableBadge key={network}>
          <Link href={getAddressExplorerUrl(network, address)} target="_blank">
            {network}
          </Link>
        </DataTableBadge>
      ))}
    </aside>
  );
};
