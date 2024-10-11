import * as React from 'react';

import { decodeFeedsConfig } from '@blocksense/config-types/data-feeds-config';

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
import { Callout } from '@blocksense/docs-theme';

type ParametersProps = {
  dataFeedsOverviewString: string;
};

export const DataFeeds = ({ dataFeedsOverviewString }: ParametersProps) => {
  const { feeds } = decodeFeedsConfig(JSON.parse(dataFeedsOverviewString));

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
          <p className="mt-4 nx-border-b nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400 py-6">
            Blocksense offers a platform to securely collect and integrate
            diverse data feeds into the blockchain. Our protocol supports many
            data types, including financial markets, DeFi metrics, weather,
            sports scores and more. Discover the data feeds available through
            the Blocksense Network.
          </p>
          <hr />
          <p className="mt-4">
            The Blocksense protocol stores all on-chain data in a single{' '}
            <code className="nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10">
              AggregatedDataFeedStore
            </code>{' '}
            contract. Every data feed is identified through a numeric ID that is
            permanently assigned for continously updating data feeds, such as
            prices, or temporarily assigned for reporting outcomes of real-world
            events, responses for specific data requests or other short-lived
            data.
          </p>
          <p className="mt-4">
            You can obtain the current value of any data feed by supplying the
            feed ID to the{' '}
            <code className="nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10">
              getValue
            </code>{' '}
            helper function. Most data feeds also retain a specific number of
            historic values that can be obtained through the{' '}
            <code className="nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10">
              getHistoricValue
            </code>{' '}
            helper.
          </p>
          <p className="mt-4">
            The{' '}
            <code className="nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10">
              AggregatedDataFeedStore
            </code>{' '}
            interface is highly efficient, but many existing DApps are based on
            price feeds provided by Chainlink. To support such DApps without
            requiring any code changes, the Blocksense team maintains a set of
            proxy contracts implementing the{' '}
            <code className="nx-border-black nx-border-opacity-[0.04] nx-bg-opacity-[0.03] nx-bg-black nx-break-words nx-rounded-md nx-border nx-py-0.5 nx-px-[.25em] nx-text-[.9em] dark:nx-border-white/10 dark:nx-bg-white/10">
              AggregatorV3Interface
            </code>{' '}
            interface.
          </p>
          <Callout type="info" emoji="📝">
            <p className="nx-mt-4 nx-leading-7 first:nx-mt-0">
              Please note that using this interface will lead to a slight gas
              cost increase for your DApp. Read our blog post for more details.
            </p>
          </Callout>
          <p className="mt-4">
            Use the interactive tables below to discover the available data
            feeds and their properties.
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
