'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import type { NetworkName } from '@blocksense/base-utils';
import type { DeploymentConfigV2 } from '@blocksense/config-types';
import { Logo } from '@blocksense/ui/Logo';

import { SelectMenu } from './SelectMenu';
import { FeedsList } from './FeedsList';

type FeedsProps = {
  networks: Array<NetworkName>;
  deploymentInfo?: Record<NetworkName, DeploymentConfigV2>;
};

export function Feeds({ deploymentInfo, networks }: FeedsProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkName | null>(
    null,
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const network = searchParams.get('network');

  useEffect(() => {
    if (
      network &&
      networks.includes(network as NetworkName) &&
      selectedNetwork !== network
    ) {
      setSelectedNetwork(network as NetworkName);
    }
  }, [network, networks]);

  const handleNetworkChange = (value: NetworkName) => {
    setSelectedNetwork(value);
    router.push(`/feeds?network=${encodeURIComponent(value)}`);
  };

  const feeds = useMemo(() => {
    if (!deploymentInfo || !selectedNetwork) return [];

    return Object.entries(
      deploymentInfo[selectedNetwork].contracts.CLAggregatorAdapter,
    ).map(([feedId, { address, constructorArgs }]) => ({
      feedId,
      name: constructorArgs[0] as string,
      address,
    }));
  }, [selectedNetwork]);

  return (
    <article className="flex flex-col gap-6">
      <section className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Price Feeds</h1>
        <Logo variant="primary-white" width={200} height={200} />
      </section>
      <SelectMenu
        selected={selectedNetwork}
        options={networks}
        onChange={handleNetworkChange}
      />
      {selectedNetwork ? (
        <FeedsList selectedNetwork={selectedNetwork} feeds={feeds} />
      ) : (
        <p className="w-full text-center">
          No feeds available. Please select a network.
        </p>
      )}
    </article>
  );
}
