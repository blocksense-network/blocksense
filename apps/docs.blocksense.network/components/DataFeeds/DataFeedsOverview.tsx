import * as React from 'react';
import Link from 'next/link';

import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

export const DataFeedsOverview = () => {
  return (
    <section className="mt-4">
      <ContractItemWrapper title="Data Feeds" titleLevel={2} itemsLength={1}>
        <article className="mt-4 mb-6">
          <p className="mt-4">
            Blocksense offers a platform to securely collect and integrate
            diverse data feeds into the blockchain. Our protocol supports many
            data types, including financial markets, DeFi metrics, weather,
            sports scores and more. Discover the data feeds available through
            the Blocksense Network.
          </p>
          <p className="mt-4">Explore our data feeds:</p>
        </article>
        {/* TODO: Make this list dynamically generated from the data feeds config */}
        <li key={'price-feeds'} className="flex items-start nx-gap-4 nx-my-2">
          <span className="grow contract__anchor mb-1 underline text-black dark:text-white">
            <strong>
              <Link href={`data-feed-types/price-feeds`}>{'Price Feeds'}</Link>
            </strong>
          </span>
        </li>
      </ContractItemWrapper>
    </section>
  );
};
