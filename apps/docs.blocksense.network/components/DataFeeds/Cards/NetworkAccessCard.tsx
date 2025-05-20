'use client';

import { useEffect, useState } from 'react';

import { DeploymentConfigV2 } from '@blocksense/config-types';
import { NetworkName } from '@blocksense/base-utils/evm';

import { useHash } from '@/hooks/useHash';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@blocksense/ui/DropdownMenu';
import { Button } from '@blocksense/ui/Button';
import { Card, CardHeader, CardTitle } from '@blocksense/ui/Card';
import { DataFeedCardContentItem } from '../DataFeedCardContentItem';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { capitalizeWords } from '@/src/utils';
import { DataFeedCardContent } from '../DataFeedCardContent';
import { Icon } from '@blocksense/ui/Icon';
import { Separator } from '@blocksense/ui/Separator';

type NetworkDropdownProps = {
  networks: NetworkName[];
  selectedNetwork: string;
  onSelect: (network: NetworkName) => void;
};

const NetworkDropdown = ({
  networks,
  selectedNetwork,
  onSelect,
}: NetworkDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="outline"
          size="sm"
          icon={
            <Icon
              icon={{
                type: 'image',
                src: '/icons/chevron-down.svg',
              }}
              size="xs"
              ariaLabel="Chevron down"
              className="invert p-0"
            />
          }
          className="mt-0 bg-white flex justify-center h-8 border-solid border-neutral-200 dark:bg-neutral-600"
        >
          {capitalizeWords(selectedNetwork) || 'Select Network'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[12rem]">
        <Separator />
        {networks.map(network => (
          <DropdownMenuItem key={network} onClick={() => onSelect(network)}>
            {capitalizeWords(network)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

type DataFeedCardContentProps = {
  deploymentInfo: DeploymentConfigV2;
};

const FeedStoreContent = ({ deploymentInfo }: DataFeedCardContentProps) => {
  return (
    <DataFeedCardContentItem
      label={
        <div className="gap-2 justify-between lg:flex lg:flex-row">
          <a href="/docs/contracts/integration-guide/using-data-feeds/aggregated-data-feed-store">
            <h5 className="hover:underline">Feed store</h5>
          </a>
          <div className="break-all">
            <ContractAddress
              address={
                deploymentInfo.contracts.coreContracts.UpgradeableProxyADFS
                  .address
              }
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
              copyButton={{ enableCopy: true, background: false }}
            />
          </div>
        </div>
      }
      value={''}
    />
  );
};

const CLAdapterContent = ({ deploymentInfo }: DataFeedCardContentProps) => {
  const clAdapterInfo = deploymentInfo.contracts.CLAggregatorAdapter[0];

  if (!clAdapterInfo) {
    return null;
  }

  return (
    <DataFeedCardContentItem
      label={
        <div className="gap-2 justify-between lg:flex lg:flex-row">
          <a href="/docs/contracts/integration-guide/using-data-feeds/cl-aggregator-adapter">
            <h5 className="hover:underline">CL Adapter</h5>
          </a>
          <div className="break-all">
            <ContractAddress
              address={clAdapterInfo.address}
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
              copyButton={{ enableCopy: true, background: false }}
            />
          </div>
        </div>
      }
      value={''}
    />
  );
};

const CLRegistryContentItem = ({
  deploymentInfo,
}: DataFeedCardContentProps) => {
  const clAdapterInfo = deploymentInfo.contracts.CLAggregatorAdapter[0];

  if (!clAdapterInfo?.base || !clAdapterInfo?.quote) {
    return null;
  }

  const { base, quote } = clAdapterInfo;

  return (
    <DataFeedCardContentItem
      label={
        <div className="gap-2 justify-between lg:flex lg:flex-row">
          <a href="/docs/contracts/integration-guide/using-data-feeds/cl-feed-registry-adapter">
            <h5 className="hover:underline">CL Feed Regisrty</h5>
          </a>
          <div className="break-all">
            <ContractAddress
              address={
                deploymentInfo.contracts.coreContracts.CLFeedRegistryAdapter
                  .address
              }
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
              copyButton={{ enableCopy: true, background: false }}
            />
          </div>
        </div>
      }
      value={
        <div className="text-sm text-gray-500 ml-2">
          <div className="ml-2 gap-2 justify-between lg:flex lg:flex-row break-all">
            base:{' '}
            <ContractAddress
              address={base}
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
              copyButton={{ enableCopy: true, background: false }}
            />
          </div>
          <div className="ml-2 gap-2 justify-between lg:flex lg:flex-row break-all">
            quote:{''}
            <ContractAddress
              address={quote}
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
              copyButton={{ enableCopy: true, background: false }}
            />
          </div>
        </div>
      }
    />
  );
};

type DataFeedCardProps = {
  feedsDeploymentInfo: DeploymentConfigV2[];
};

export const NetworkAccessCard = ({
  feedsDeploymentInfo,
}: DataFeedCardProps) => {
  const networks = feedsDeploymentInfo.map(networkData => networkData.network);
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0]);
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentConfigV2>(
    feedsDeploymentInfo.find(
      networkData => networkData.network === networks[0],
    )!,
  );
  const { hash, setNewHash } = useHash();
  const networkFromHash = hash.replace('#', '');

  useEffect(() => {
    if (networkFromHash && networks.includes(networkFromHash as NetworkName)) {
      changeNetwork(networkFromHash as NetworkName);
    }
  }, [feedsDeploymentInfo, networks, networkFromHash]);

  useEffect(() => {
    if (selectedNetwork && selectedNetwork !== networkFromHash) {
      setNewHash(`#${selectedNetwork}`);
    }
  }, [selectedNetwork]);

  const handleNetworkSelect = (network: NetworkName) => {
    setNewHash(`#${network}`);
    changeNetwork(network);
  };

  const changeNetwork = (network: NetworkName) => {
    setSelectedNetwork(network);
    setDeploymentInfo(
      feedsDeploymentInfo.find(data => data.network === network)!,
    );
  };

  return (
    <Card className="data-feed-card-section px-2 py-2">
      <CardHeader className="data-feed-card__header flex flex-col space-y-1.5 px-4 mt-3 mb-3">
        <CardTitle className="data-feed-card__title text-xl font-semibold text-gray-900">
          Network Access
        </CardTitle>

        <div className="flex justify-end">
          <NetworkDropdown
            networks={networks}
            selectedNetwork={selectedNetwork}
            onSelect={handleNetworkSelect}
          />
        </div>
      </CardHeader>
      <DataFeedCardContent>
        <FeedStoreContent deploymentInfo={deploymentInfo} />
        <CLAdapterContent deploymentInfo={deploymentInfo} />
        <CLRegistryContentItem deploymentInfo={deploymentInfo} />
      </DataFeedCardContent>
    </Card>
  );
};
