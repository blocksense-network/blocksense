'use client';

import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';
import { DataTable } from '@blocksense/ui/DataTable';

import { columns } from '@/components/DataFeeds/columns';
import { dataFeedUrl } from '@/src/constants';

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
