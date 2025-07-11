'use client';

import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';

import { columns } from '@/components/DataFeeds/columns';
import { dataFeedUrl } from '@/src/constants';
import { DataTable } from '@/components/common/DataTable/DataTable';
import {
  cellHaveContent,
  DataRowType,
} from '../common/DataTable/dataTableUtils';

export const DataFeedsTable = ({ feeds }: { feeds: FeedsConfig['feeds'] }) => {
  function getRowLink(row: DataRowType) {
    return dataFeedUrl && cellHaveContent(row.id)
      ? `${dataFeedUrl}${row.id}`
      : '';
  }

  return (
    <DataTable
      columns={columns}
      data={feeds}
      filterCell="full_name"
      getRowLink={getRowLink}
      hasToolbar
    />
  );
};
