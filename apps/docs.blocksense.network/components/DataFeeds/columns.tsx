import { Tooltip } from '@blocksense/ui/Tooltip';

import { DataTableColumnHeader } from '@/components/common/DataTable/DataTableColumnHeader';
import { DataTableBadge } from '@/components/common/DataTable/DataTableBadge';
import { ColumnDef } from '@/components/common/DataTable/dataTableUtils';
import { capitalizeWords } from '@/src/utils';

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
    title: 'Data Feed Name',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <Tooltip position="right">
        <Tooltip.Content>{row.description}</Tooltip.Content>
        <DataTableBadge>{row.full_name}</DataTableBadge>
      </Tooltip>
    ),
  },
  {
    id: 'base',
    title: 'Base',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <DataTableBadge>{row.additional_feed_info.pair.base}</DataTableBadge>
    ),
  },
  {
    id: 'quote',
    title: 'Quote',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <DataTableBadge>{row.additional_feed_info.pair.quote}</DataTableBadge>
    ),
  },
  {
    id: 'decimals',
    title: 'Decimals',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <DataTableBadge>{row.additional_feed_info.decimals}</DataTableBadge>
    ),
  },
  {
    id: 'type',
    title: 'Feed Type',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <DataTableBadge>{capitalizeWords(row.type)}</DataTableBadge>
    ),
  },
  {
    id: 'category',
    title: 'Category',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <DataTableBadge>{row.additional_feed_info.category}</DataTableBadge>
    ),
  },
];
