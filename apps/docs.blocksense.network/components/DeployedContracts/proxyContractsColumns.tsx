import { Tooltip } from '@blocksense/ui/Tooltip';

import { DataTableColumnHeader } from '@/components/common/DataTable/DataTableColumnHeader';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { DataTableBadge } from '@/components/common/DataTable/DataTableBadge';
import { NetworkAddressExplorerLink } from '@/components/DeployedContracts/NetworkAddressExplorerLink';
import { ColumnDef } from '@/components/common/DataTable/dataTableUtils';

export const columns: ColumnDef[] = [
  {
    id: 'id',
    title: 'Id',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => <DataTableBadge>{row.id}</DataTableBadge>,
  },
  {
    id: 'description',
    title: 'Data Feed Name',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <Tooltip position="right">
        <Tooltip.Content>Data Feed Info</Tooltip.Content>
        <DataTableBadge>{row.description}</DataTableBadge>
      </Tooltip>
    ),
  },
  {
    id: 'network',
    title: 'Network',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <NetworkAddressExplorerLink
        address={row.address}
        networks={[row.network]}
      />
    ),
  },
  {
    id: 'address',
    title: 'Blocksense Proxy Address',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
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
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
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
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
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
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <ContractAddress
        network={row.network}
        address={row.chainlink_proxy ?? ''}
        copyButton={{ enableCopy: true, background: false }}
        abbreviation={{ hasAbbreviation: true }}
      />
    ),
  },
];
