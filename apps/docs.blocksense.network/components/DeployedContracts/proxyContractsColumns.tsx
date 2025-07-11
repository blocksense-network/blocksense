import { DataTableColumnHeader } from '@/components/common/DataTable/DataTableColumnHeader';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { DataTableBadge } from '@/components/common/DataTable/DataTableBadge';
import { ColumnDef } from '@/components/common/DataTable/dataTableUtils';

export const columns: ColumnDef[] = [
  {
    id: 'id',
    title: 'Id',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => <DataTableBadge>{row.id}</DataTableBadge>,
    facetedFilter: true,
  },
  {
    id: 'name',
    title: 'Data Feed',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => <DataTableBadge>{row.name}</DataTableBadge>,
  },
  {
    id: 'address',
    title: 'CL Aggregator Adapter',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <ContractAddress
        network={row.network}
        address={row.address}
        copyButton={{ enableCopy: true, background: false }}
        abbreviation={{ hasAbbreviation: false }}
      />
    ),
  },
];
