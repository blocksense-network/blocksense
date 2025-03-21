import { Tooltip } from '@blocksense/ui/Tooltip';

import { DataTableColumnHeader } from '@/components/ui/DataTable/DataTableColumnHeader';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';
import { ColumnDef } from '../ui/DataTable/DataTable';

type DataFeed = {
  id: number;
  description: string;
  decimals: number;
  report_interval_ms: number;
};

export const dataFeedsColumnsTitles: { [key: string]: string } = {
  id: 'Id',
  description: 'Data Feed Name',
  decimals: 'Decimals',
  report_interval_ms: 'Refresh Interval (ms)',
};

export const columns: ColumnDef[] = [
  {
    id: 'id',
    title: 'Id',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: DataFeed }) => (
      <DataTableBadge>{row.id}</DataTableBadge>
    ),
    facetedFilter: true,
  },
  {
    id: 'description',
    title: 'Data Feed Name',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: DataFeed }) => (
      <Tooltip position="right">
        <Tooltip.Content>Data Feed Info</Tooltip.Content>
        <DataTableBadge>{row.description}</DataTableBadge>
      </Tooltip>
    ),
  },
  {
    id: 'decimals',
    title: 'Decimals',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
    cell: ({ row }: { row: DataFeed }) => (
      <DataTableBadge>{row.decimals}</DataTableBadge>
    ),
  },
  {
    id: 'report_interval_ms',
    title: 'Refresh Interval (ms)',
    header: ({ column }: { column: ColumnDef }) => (
      <DataTableColumnHeader title={column.title} />
    ),
  },
];
