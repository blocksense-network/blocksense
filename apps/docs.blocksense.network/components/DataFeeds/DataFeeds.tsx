import * as React from 'react';

import { decodeFeedsConfig } from '@blocksense/config-types/data-feeds-config';

import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import {
  DataTable,
  getFacetedFilters,
} from '@/components/ui/DataTable/DataTable';
import {
  columns,
  dataFeedsColumnsTitles,
} from '@/components/DataFeeds/columns';

type ParametersProps = {
  dataFeedsOverviewString: string;
};

export const DataFeeds = ({ dataFeedsOverviewString }: ParametersProps) => {
  const { feeds } = decodeFeedsConfig(JSON.parse(dataFeedsOverviewString));

  const filters = React.useMemo(
    () => getFacetedFilters(['id', 'script'], feeds, dataFeedsColumnsTitles),
    [feeds],
  );

  return (
    <ContractItemWrapper
      title="Data Feeds"
      titleLevel={2}
      itemsLength={feeds.length}
    >
      <p className="mt-2">
        Blocksense provides a platform for securely and efficiently collecting
        various data feeds and integrating them into the blockchain ecosystem.
        Our protocol supports a wide range of data types, from financial market
        data and decentralized finance (DeFi) metrics to weather data, sports
        scores, and more. Explore the range of data feeds provided by the
        Blocksense Network.
      </p>
      <DataTable
        columns={columns}
        data={feeds}
        filterCell={'description'}
        filters={filters}
        columnsTitles={dataFeedsColumnsTitles}
      />
    </ContractItemWrapper>
  );
};
