import { Tooltip } from '@blocksense/ui/Tooltip';
import { DataTableColumnHeader } from '@blocksense/ui/DataTable';
import { DataTableBadge } from '@blocksense/ui/DataTable';
import { ColumnDef } from '@blocksense/ui/DataTable';

export const columns: ColumnDef[] = [
  {
    id: 'id',
    title: 'Id',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => <DataTableBadge>{row.id}</DataTableBadge>,
    facetedFilter: true,
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
    id: 'decimals',
    title: 'Decimals',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => <DataTableBadge>{row.decimals}</DataTableBadge>,
  },
  {
    id: 'report_interval_ms',
    title: 'Refresh Interval (ms)',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
  },
];
