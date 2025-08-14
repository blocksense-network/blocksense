'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import type { NetworkName } from '@blocksense/base-utils';

type Feed = {
  feedId: string;
  name: string;
  address: string;
};

type FeedsListProps = {
  selectedNetwork: NetworkName;
  feeds: Array<Feed>;
};

export function FeedsList({ feeds, selectedNetwork }: FeedsListProps) {
  const [search, setSearch] = useState('');

  const filteredFeeds = useMemo(() => {
    return feeds.filter(feed =>
      feed.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [selectedNetwork, search]);

  return (
    <>
      <section className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search feeds..."
          className="w-full py-2 px-4 border border-none rounded-[100px] bg-[var(--gray)] text-[var(--light-gray)] outline-none focus:ring-0"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <h2 className="text-xl">{filteredFeeds.length}</h2>
      </section>
      <ul
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(375px, 1fr))',
        }}
      >
        {filteredFeeds.length === 0 && (
          <p className="w-full text-center">No feeds available.</p>
        )}
        {filteredFeeds.map(feed => (
          <Link
            href={`/feed/${feed.name.split(' / ').join('-').toLocaleLowerCase()}-${feed.feedId}?network=${encodeURIComponent(
              selectedNetwork,
            )}`}
            key={feed.feedId}
          >
            <li className="p-4 border border-none rounded-lg bg-[var(--gray)] flex flex-col gap-2">
              <section className="flex justify-between items-center">
                <span>
                  <strong>Id:</strong>
                  {feed.feedId}
                </span>
                <span className="px-2 border border-[var(--light-gray)] rounded-sm">
                  Crypto
                </span>
              </section>
              <h2 className="text-lg font-semibold">{feed.name}</h2>
              <p className="text-sm flex gap-2">
                <span>Networks: 6</span>
                <span>Sources: 4</span>
              </p>
              <p className="text-sm">{feed.address}</p>
            </li>
          </Link>
        ))}
      </ul>
    </>
  );
}
