import * as React from 'react';
import type { GetStaticProps } from 'next';
import {
  decodeFeedsConfig,
  FeedsConfig,
} from '@blocksense/config-types/data-feeds-config';
import DATA_FEEDS from '@blocksense/monorepo/feeds_config';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import {
  columns,
  dataFeedsColumnsTitles,
} from '@/components/DataFeeds/columns';
import { dataFeedUrl } from '@/src/constants';

import {
  DataTable,
  getFacetedFilters,
} from '@/components/ui/DataTable/DataTable';

export const getStaticProps = (() => {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);

  return { props: { feedsConfig }, revalidate: false };
}) satisfies GetStaticProps<{
  feedsConfig: FeedsConfig;
}>;

type DataFeedsProps = {
  feedsConfig: FeedsConfig;
};

export const DataFeeds = ({ feedsConfig: { feeds } }: DataFeedsProps) => {
  const filters = React.useMemo(
    () => getFacetedFilters(['id'], feeds, dataFeedsColumnsTitles),
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
          <p className="mt-4">
            Blocksense offers a platform to securely collect and integrate
            diverse data feeds into the blockchain. Our protocol supports many
            data types, including financial markets, DeFi metrics, weather,
            sports scores and more. Discover the data feeds available through
            the Blocksense Network.
          </p>
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
