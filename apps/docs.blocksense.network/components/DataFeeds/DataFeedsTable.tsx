'use client';

import * as React from 'react';
import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';
import {
  columns,
  dataFeedsColumnsTitles,
} from '@/components/DataFeeds/columns';
import { dataFeedUrl } from '@/src/constants';
import {
  DataTable,
  getFacetedFilters,
} from '@/components/ui/DataTable/DataTable';

export const DataFeedsTable = ({ feeds }: { feeds: FeedsConfig['feeds'] }) => {
  const filters = React.useMemo(
    () => getFacetedFilters(['id'], feeds, dataFeedsColumnsTitles),
    [feeds],
  );

  return (
    <DataTable
      columns={columns}
      data={feeds}
      filterCell={'description'}
      filters={filters}
      columnsTitles={dataFeedsColumnsTitles}
      rowLink={dataFeedUrl}
    />
  );
};
