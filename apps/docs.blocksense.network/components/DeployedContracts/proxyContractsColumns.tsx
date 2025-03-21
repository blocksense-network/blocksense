import { Tooltip } from '@blocksense/ui/Tooltip';
import { ProxyContractData } from '@/src/deployed-contracts/types';
import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';
import { NetworkAddressExplorerLink } from '@/components/DeployedContracts/NetworkAddressExplorerLink';

import { ColumnDef } from '../ui/DataTable/DataTable';

export const columns: ColumnDef[] = [
  {
    id: 'id',
    title: 'Id',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: ProxyContractData }) => (
      <DataTableBadge>{row.id}</DataTableBadge>
    ),
  },
  {
    id: 'description',
    title: 'Data Feed Name',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: ProxyContractData }) => (
      <Tooltip position="right">
        <Tooltip.Content>Data Feed Info</Tooltip.Content>
        <DataTableBadge>{row.description}</DataTableBadge>
      </Tooltip>
    ),
  },
  {
    id: 'network',
    title: 'Network',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: ProxyContractData }) => (
      <NetworkAddressExplorerLink
        address={row.address}
        networks={[row.network]}
      />
    ),
  },
  {
    id: 'address',
    title: 'Blocksense Proxy Address',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: ProxyContractData }) => (
      <ContractAddress
        network={row.network}
        address={row.address}
        copyButton={{ enableCopy: true, background: false }}
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
  {
    id: 'base',
    title: 'Base Address',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: ProxyContractData }) => (
      <ContractAddress
        network={row.network}
        address={row.base ?? ''}
        copyButton={{ enableCopy: true, background: false }}
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
  {
    id: 'quote',
    title: 'Quote Address',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: ProxyContractData }) => (
      <ContractAddress
        network={row.network}
        address={row.quote ?? ''}
        copyButton={{ enableCopy: true, background: false }}
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
  {
    id: 'chainlink_proxy',
    title: 'CL Aggregator Proxy Address',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: ProxyContractData }) => (
      <ContractAddress
        network={row.network}
        address={row.chainlink_proxy ?? ''}
        copyButton={{ enableCopy: true, background: false }}
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
];
