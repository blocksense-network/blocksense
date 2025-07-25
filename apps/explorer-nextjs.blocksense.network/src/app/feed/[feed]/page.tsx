import type { Metadata } from 'next';

import { readAllEvmDeployments } from '@blocksense/config-types';
import type { NetworkName } from '@blocksense/base-utils';

import Feed from '@/components/Feed';

type Props = {
  params: { feed: string };
  searchParams: { network?: NetworkName };
};

function getFeedNameAndId(feed: string) {
  const feedParts = feed.split('-');
  const feedId = feedParts[feedParts.length - 1];
  const feedName = feedParts.slice(0, -1).join(' / ').toLocaleUpperCase();
  return { feedName, feedId };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { feed } = params;
  const { feedName } = getFeedNameAndId(feed);
  return {
    title: `${feedName} | Blocksense`,
  };
}

type FeedPageProps = {
  params: { feed: string };
  searchParams: { network?: NetworkName };
};

export default async function FeedPage({
  params,
  searchParams,
}: FeedPageProps) {
  const { feed } = params;
  const network = searchParams.network;
  const { feedId } = getFeedNameAndId(feed);

  const deploymentInfo = await readAllEvmDeployments(['local']);
  if (!network || !deploymentInfo[network]) {
    return <p>Please select a network.</p>;
  }
  const feedConfig =
    deploymentInfo[network].contracts.CLAggregatorAdapter[feedId];

  return (
    <section className="flex flex-col gap-6 bg-[var(--gray)] p-8 rounded-3xl w-full h-full">
      <h1 className="text-2xl text-center font-bold">
        {feedConfig.constructorArgs[0]}
      </h1>
      <Feed
        contractAddress={feedConfig.address as `0x${string}`}
        network={network}
        feedId={feedId}
      />
    </section>
  );
}
