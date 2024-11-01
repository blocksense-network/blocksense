import React from 'react';
import {
  decodeFeedsConfig,
  Feed,
} from '@blocksense/config-types/data-feeds-config';
import {
  ChainlinkProxyData,
  decodeDeploymentConfig,
} from '@blocksense/config-types/evm-contracts-deployment';

import { DataFeedCardSection } from '@/components/DataFeeds/DataFeedCardSection';
import { DataFeedCardContentItem } from '@/components/DataFeeds/DataFeedCardContentItem';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { CopyButton } from '@/components/common/CopyButton';

import { QuestionsCardContent } from '@/components/DataFeeds/QuestionsCardContent';

import DATA_FEEDS from '@blocksense/monorepo/feeds_config';
import CONTRACTS_DEPLOYMENT_CONFIG from '@blocksense/monorepo/evm_contracts_deployment_v1';

import type { GetStaticProps, GetStaticPaths } from 'next';

export const getStaticPaths = (async () => {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  const paths = feedsConfig.feeds.map(feed => ({
    params: { feed: String(feed.id) },
  }));

  return { paths, fallback: false };
}) satisfies GetStaticPaths;

export const getStaticProps = (async context => {
  const feedId = context.params?.['feed'] as string;

  if (feedId === '') {
    return { notFound: true };
  }

  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  const feedsDeploymentInfo = decodeDeploymentConfig(
    CONTRACTS_DEPLOYMENT_CONFIG,
  )['ethereum-sepolia']?.contracts?.ChainlinkProxy;
  const feed = feedsConfig.feeds.find(feed => feed.id === Number(feedId));

  if (!feed) {
    return { notFound: true };
  }

  const feedDeploymentInfo = feedsDeploymentInfo?.find(
    (info: ChainlinkProxyData) => info.description === feed.description,
  );

  if (!feedDeploymentInfo) {
    throw new Error(
      `No deployment info found for feed: ${feed.description} (${feed.id})`,
    );
  }

  return { props: { feed, feedDeploymentInfo }, revalidate: false };
}) satisfies GetStaticProps<{
  feed: Feed;
  feedDeploymentInfo: ChainlinkProxyData;
}>;

export const DataFeedPage = (feedData: {
  feed: Feed;
  feedDeploymentInfo: ChainlinkProxyData;
}) => {
  const {
    id,
    description,
    decimals,
    pair,
    report_interval_ms,
    quorum_percentage,
    type,
  } = feedData.feed;

  const { base, quote, address } = feedData.feedDeploymentInfo;

  const feedRegistry = {
    directAccess: (
      <div className="text-sm text-gray-500 ml-2">
        {
          <div className="flex gap-2 justify-between ">
            Feed id:
            <span className="flex gap-2">
              <code className="inline">{id}</code>
              <CopyButton
                textToCopy={`${id}`}
                tooltipPosition="top"
                copyButtonClasses="translate-x-1"
              />
            </span>
          </div>
        }
      </div>
    ),
    chainlinkStyleRegistry:
      base && quote ? (
        <div className="text-sm text-gray-500 ml-2">
          <div className="flex gap-2 justify-between">
            base:{' '}
            <ContractAddress
              address={base}
              enableCopy
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
            />
          </div>
          <div className="flex gap-2 justify-between">
            quote:{''}
            <ContractAddress
              address={quote}
              enableCopy
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
            />
          </div>
        </div>
      ) : undefined,
    aggregatorProxyAddress: (
      <div className="text-sm text-gray-500 ml-2 flex gap-2 justify-between">
        address:{' '}
        <ContractAddress
          address={address}
          enableCopy
          abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
        />
      </div>
    ),
  };

  const dataFeedCardArray = [
    {
      title: 'Core Properties',
      description:
        'Define elements of a single price feed and provide transparency, reliability, and security in data updates',
      items: [
        { label: 'Name', value: description },
        { label: 'Feed ID', value: id },
        { label: 'Quorum Percentage', value: `${quorum_percentage * 100}%` },
      ],
    },
    {
      title: 'Price Feed Properties',
      description:
        'Outline properties of a price feed, such as key features and guarantee consistent, timely updates',
      items: [
        { label: 'Pair', value: `${pair.base} / ${pair.quote}` },
        { label: 'Decimals', value: decimals },
        {
          label: 'Report Interval',
          value: `${(report_interval_ms / 1000).toFixed(2)} seconds`,
        },
        {
          label: 'Category',
          value: typeof type === 'string' ? type : String(type),
        },
        { label: 'Data Providers', value: 'No information yet' },
      ],
    },
  ];

  return (
    <div className="data-feed-details">
      <h1 className="text-2xl font-bold text-gray-900 mt-10">
        {description} | ID: {id}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full lg:w-[42rem] xl:w-[45rem]">
        {dataFeedCardArray.map((section, index) => (
          <DataFeedCardSection
            key={index}
            title={section.title}
            description={section.description}
          >
            <div className="data-feed-card-content grid grid-cols-2 gap-4">
              {section.items.map((item, idx) => (
                <DataFeedCardContentItem
                  key={idx}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </DataFeedCardSection>
        ))}
        <DataFeedCardSection
          key={dataFeedCardArray.length}
          title="EVM Access Info"
          description="To access that from this feed on-chain you can use one of the following approaches:"
        >
          <DataFeedCardContentItem
            label={
              <a
                href="/docs/contracts/integration-guide/using-data-feeds/historic-data-feed"
                target="_blank"
                rel="noopener noreferrer"
              >
                <h5 className="hover:underline">
                  ProxyCall for direct access:
                </h5>
              </a>
            }
            value={feedRegistry.directAccess}
          />
          <DataFeedCardContentItem
            label={
              <a
                href="/docs/contracts/integration-guide/using-data-feeds/chainlink-proxy"
                target="_blank"
                rel="noopener noreferrer"
              >
                <h5 className="hover:underline">
                  Chainlink-style AggregatorProxy:
                </h5>
              </a>
            }
            value={feedRegistry.aggregatorProxyAddress}
          />
          {feedRegistry.chainlinkStyleRegistry && (
            <div className="data-feed-card-content">
              <DataFeedCardContentItem
                label={
                  <a
                    href="/docs/contracts/integration-guide/using-data-feeds/feed-registry"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <h5 className="hover:underline">
                      Chainlink-style FeedRegistry:
                    </h5>
                  </a>
                }
                value={feedRegistry.chainlinkStyleRegistry}
              />
            </div>
          )}
        </DataFeedCardSection>
        <DataFeedCardSection
          key={dataFeedCardArray.length}
          title="Questions?"
          description="If you have any questions speak with our team on one of the following platforms:"
        >
          <DataFeedCardContentItem label="" value={<QuestionsCardContent />} />
        </DataFeedCardSection>
      </div>
    </div>
  );
};
