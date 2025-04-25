'use client';

import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';

import { columns } from '@/components/DataFeeds/columns';
import { dataFeedUrl } from '@/src/constants';
import { DataTable } from '@/components/common/DataTable/DataTable';

export const DataFeedsTable = ({ feeds }: { feeds: FeedsConfig['feeds'] }) => {
  return (
    <DataTable
      columns={columns}
      data={feeds}
      filterCell="description"
      rowLink={dataFeedUrl}
      hasToolbar
    />
  );
};
