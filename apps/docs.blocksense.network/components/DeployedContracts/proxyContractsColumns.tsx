import * as React from 'react';

import { ColumnDef } from '@tanstack/react-table';

import { ProxyContractData } from '@/src/deployed-contracts/types';
import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';
import { NetworkAddressExplorerLink } from '@/components/DeployedContracts/NetworkAddressExplorerLink';
import { Tooltip } from '@/components/common/Tooltip';

export const proxyColumnsTitles: { [key: string]: string } = {
  description: 'Data Feed Name',
  id: 'Id',
  address: 'Blocksense Aggregator Address',
  base: 'Base Address',
  quote: 'Quote Address',
  chainlink_proxy: 'CL Aggregator Proxy Address',
  network: 'Network',
};

export const columns: ColumnDef<ProxyContractData>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => <DataTableBadge>{row.getValue('id')}</DataTableBadge>,
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => (
      <Tooltip position="right">
        <Tooltip.Content>Data Feed Info</Tooltip.Content>
        <DataTableBadge>{row.getValue('description')}</DataTableBadge>
      </Tooltip>
    ),
  },
  {
    accessorKey: 'network',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => (
      <NetworkAddressExplorerLink
        address={row.original.address}
        networks={[row.original.network]}
      />
    ),
  },
  {
    accessorKey: 'address',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress
        network={row.original.network}
        address={row.getValue('address')}
        enableCopy
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
  {
    accessorKey: 'base',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress
        network={row.original.network}
        address={row.getValue('base')}
        enableCopy
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
  {
    accessorKey: 'quote',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress
        network={row.original.network}
        address={row.getValue('quote')}
        enableCopy
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
  {
    accessorKey: 'chainlink_proxy',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={proxyColumnsTitles[column.id]}
      />
    ),
    cell: ({ row }) => (
      <ContractAddress
        network={row.original.network}
        address={row.getValue('chainlink_proxy')}
        enableCopy
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
];
