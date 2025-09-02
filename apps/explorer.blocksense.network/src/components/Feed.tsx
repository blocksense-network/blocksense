'use client';

import { useEffect, useState } from 'react';

import type { NetworkName } from '@blocksense/base-utils';

import { getPriceAndDecimalsAction } from '@/app/actions';
import { FeedPriceChart } from '@/components/FeedPriceChart';

type FeedProps = {
  contractAddress: `0x${string}`;
  network: NetworkName;
  feedId: string;
};

export default function Feed({ contractAddress, feedId, network }: FeedProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [decimals, setDecimals] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [points, setPoints] = useState<
    Array<{ timestamp: number; value: number }>
  >([]);

  useEffect(() => {
    const fetchPrice = async () => {
      const { decimals: fetchedDecimals, price: fetchedPrice } =
        await getPriceAndDecimalsAction(contractAddress, network);
      console.log(`Fetched price: ${fetchedPrice}`);

      setPrice(fetchedPrice);
      setDecimals(fetchedDecimals);
      setLastUpdated(Date.now());
      setPoints(state => [
        ...state,
        { timestamp: Date.now(), value: fetchedPrice },
      ]);
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [contractAddress, network]);

  return (
    <>
      <section className="flex justify-between items-center">
        <article>
          <h2 className="text-xl">
            <strong>{price || '...'}</strong>
          </h2>
          <p className="text-[var(--light-gray)] text-sm">
            Decimals: {decimals || '...'}
          </p>
          <p className="text-[var(--light-gray)] text-sm">
            Last updated:{' '}
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '...'}
          </p>
        </article>
        <section>
          <p className="text-sm text-[var(--white)] font-bold">Id: {feedId}</p>
          <p className="text-sm text-[var(--light-gray)]">{contractAddress}</p>
          <p className="text-sm text-[var(--light-gray)]">Network: {network}</p>
        </section>
      </section>
      <FeedPriceChart points={points} />
    </>
  );
}
