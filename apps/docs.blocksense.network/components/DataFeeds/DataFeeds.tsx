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
import { dataFeedUrl } from '@/src/constants';

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
    <section className="mt-4">
      <ContractItemWrapper
        title="Data Feeds"
        titleLevel={2}
        itemsLength={feeds.length}
      >
        <article className="mt-4 mb-6">
          <span className="text-gray-500 text-md">
            Blocksense offers a platform to securely collect and integrate
            diverse data feeds into the blockchain. Our protocol supports many
            data types, including financial markets, DeFi metrics, weather,
            sports scores, and more. Discover the data feeds available through
            the Blocksense Network.
          </span>
        </article>
        <DataTable
          columns={columns}
          data={feeds}
          filterCell={'description'}
          filters={filters}
          columnsTitles={dataFeedsColumnsTitles}
          rowLink={dataFeedUrl}
        />
      </ContractItemWrapper>
    </section>
  );
};
