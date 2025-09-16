'use client';

import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';
import { Tooltip } from '@blocksense/docs-ui/Tooltip';

import { dataFeedUrl } from '@/src/constants';
import { DataTable } from '@/components/common/DataTable/DataTable';
import {
  cellHaveContent,
  DataRowType,
} from '@/components/common/DataTable/dataTableUtils';
import { DataTableColumnHeader } from '@/components/common/DataTable/DataTableColumnHeader';
import { DataTableBadge } from '@/components/common/DataTable/DataTableBadge';

export const DataFeedsTable = ({ feeds }: { feeds: FeedsConfig['feeds'] }) => {
  function getRowLink(row: DataRowType) {
    return dataFeedUrl && cellHaveContent(row.id)
      ? `${dataFeedUrl}${row.id}`
      : '';
  }

  return (
    <DataTable
      columns={[
        {
          id: 'id',
          title: 'Id',
          header: ({ column }) => (
            <DataTableColumnHeader title={column.title} />
          ),
          accessor: row => row.id,
          cell: ({ row }) => <DataTableBadge>{row.id}</DataTableBadge>,
          facetedFilter: true,
        },
        {
          id: 'full_name',
          title: 'Data Feed Name',
          header: ({ column }) => (
            <DataTableColumnHeader title={column.title} />
          ),
          accessor: row => row.full_name,
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
          header: ({ column }) => (
            <DataTableColumnHeader title={column.title} />
          ),
          accessor: row => row.additional_feed_info.pair.base,
          cell: ({ row }) => (
            <DataTableBadge>
              {row.additional_feed_info.pair.base}
            </DataTableBadge>
          ),
        },
        {
          id: 'quote',
          title: 'Quote',
          header: ({ column }) => (
            <DataTableColumnHeader title={column.title} />
          ),
          accessor: row => row.additional_feed_info.pair.quote,
          cell: ({ row }) => (
            <DataTableBadge>
              {row.additional_feed_info.pair.quote}
            </DataTableBadge>
          ),
          facetedFilter: true,
        },
        {
          id: 'decimals',
          title: 'Decimals',
          header: ({ column }) => (
            <DataTableColumnHeader title={column.title} />
          ),
          accessor: row => row.additional_feed_info.decimals,
          cell: ({ row }) => (
            <DataTableBadge>{row.additional_feed_info.decimals}</DataTableBadge>
          ),
        },
        {
          id: 'category',
          title: 'Category',
          header: ({ column }) => (
            <DataTableColumnHeader title={column.title} />
          ),
          accessor: row => row.additional_feed_info.category,
          cell: ({ row }) => (
            <DataTableBadge>{row.additional_feed_info.category}</DataTableBadge>
          ),
          facetedFilter: true,
        },
        {
          id: 'oracle_id',
          title: 'Oracle Script',
          header: ({ column }) => (
            <DataTableColumnHeader title={column.title} />
          ),
          accessor: row => row.oracle_id,
          cell: ({ row }) => <DataTableBadge>{row.oracle_id}</DataTableBadge>,
          facetedFilter: true,
        },
      ]}
      data={feeds}
      filterCell="full_name"
      getRowLink={getRowLink}
      hasToolbar
    />
  );
};
