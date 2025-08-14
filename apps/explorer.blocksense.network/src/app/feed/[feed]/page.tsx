import type { Metadata } from 'next';

import { readAllEvmDeployments } from '@blocksense/config-types';
import type { NetworkName } from '@blocksense/base-utils';

import Feed from '@/components/Feed';

function getFeedNameAndId(feed: string) {
  const feedParts = feed.split('-');
  const feedId = feedParts[feedParts.length - 1];
  const feedName = feedParts.slice(0, -1).join(' / ').toLocaleUpperCase();
  return { feedName, feedId };
}

export async function generateStaticParams() {
  const deploymentInfo = await readAllEvmDeployments([
    'local',
    'somnia-mainnet',
  ]);

  const params: Array<{ feed: string }> = [];
  for (const network of Object.keys(deploymentInfo) as Array<NetworkName>) {
    const adapter = deploymentInfo[network].contracts.CLAggregatorAdapter;
    for (const [feedId, contract] of Object.entries(adapter)) {
      const rawName = contract.constructorArgs[0] as string;
      const slug = rawName
        .toLowerCase()
        .replace(/\s+\/\s+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '');

      params.push({ feed: `${slug}-${feedId}` });
    }
  }

  return params;
}

type MetadataProps = {
  params: Promise<{ feed: string }>;
};

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { feed } = await params;
  const { feedName } = getFeedNameAndId(feed);
  return { title: `${feedName} | Blocksense` };
}

type FeedPageProps = {
  params: Promise<{ feed: string; network: NetworkName }>;
  searchParams: Promise<{ network?: NetworkName }>;
};

export default async function FeedPage({
  params,
  searchParams,
}: FeedPageProps) {
  const { feed } = await params;
  const { network } = await searchParams;
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
