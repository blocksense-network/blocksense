import * as React from 'react';
import {
  decodeFeedsConfig,
  FeedsConfig,
} from '@blocksense/config-types/data-feeds-config';
import DATA_FEEDS from '@blocksense/data-feeds-config-generator/feeds_config';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { DataFeedsTable } from '@/components/DataFeeds/DataFeedsTable';

export function getFeedsConfig() {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  return feedsConfig;
}

type DataFeedsProps = {
  feedsConfig: FeedsConfig;
};

export const DataFeeds = ({ feedsConfig: { feeds } }: DataFeedsProps) => {
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
        <DataFeedsTable feeds={feeds} />
      </ContractItemWrapper>
    </section>
  );
};
