import DATA_FEEDS from '@blocksense/data-feeds-config-generator/feeds_config';
import CONTRACTS_DEPLOYMENT_CONFIG from '@blocksense/data-feeds-config-generator/evm_contracts_deployment_v1';
import { decodeFeedsConfig } from '@blocksense/config-types/data-feeds-config';
import {
  CLAggregatorAdapterData,
  decodeDeploymentConfigV1,
} from '@blocksense/config-types/evm-contracts-deployment';

import { Error404 } from '@/components/common/Error404';
import { DataFeedCardSection } from '@/components/DataFeeds/DataFeedCardSection';
import { DataFeedCardContentItem } from '@/components/DataFeeds/DataFeedCardContentItem';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { CopyButton } from '@blocksense/ui/CopyButton';
import { QuestionsCardContent } from '@/components/DataFeeds/QuestionsCardContent';

export function generateStaticParams() {
  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  return feedsConfig.feeds.map(feed => ({
    feed: String(feed.id),
  }));
}

type DataFeedProps = {
  params: {
    feed: string;
  };
};

export default async function DataFeed({ params }: DataFeedProps) {
  const { feed: feedId } = await params;

  if (!feedId) {
    return <Error404 />;
  }

  const feedsConfig = decodeFeedsConfig(DATA_FEEDS);
  const feedsDeploymentInfo = decodeDeploymentConfigV1(
    CONTRACTS_DEPLOYMENT_CONFIG,
  )['ethereum-sepolia']?.contracts?.CLAggregatorAdapter;
  const feed = feedsConfig.feeds.find(feed => feed.id === Number(feedId));

  if (!feed) {
    return <Error404 />;
  }

  const feedDeploymentInfo = feedsDeploymentInfo?.find(
    (info: CLAggregatorAdapterData) => info.description === feed.description,
  );

  if (!feedDeploymentInfo) {
    console.error(
      `No deployment info found for feed: ${feed.description} (${feed.id})`,
    );
    return <Error404 />;
  }

  const {
    id,
    description,
    decimals,
    pair,
    report_interval_ms,
    quorum_percentage,
    type,
  } = feed;

  const { base, quote, address } = feedDeploymentInfo;

  const feedRegistry = {
    directAccess: (
      <div className="text-sm text-gray-500 ml-2">
        {
          <div className="flex gap-2 justify-between items-center break-all">
            Feed id:
            <span className="flex gap-2 items-center">
              <code className="inline">{id}</code>
              <CopyButton
                textToCopy={`${id}`}
                tooltipPosition="top"
                copyButtonClasses="translate-x-1"
                background={false}
              />
            </span>
          </div>
        }
      </div>
    ),
    chainlinkStyleRegistry:
      base && quote ? (
        <div className="text-sm text-gray-500 ml-2">
          <div className="flex flex-col gap-2 justify-between break-all">
            base:{' '}
            <ContractAddress
              address={base}
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
              copyButton={{ enableCopy: true, background: false }}
            />
          </div>
          <div className="flex flex-col gap-2 justify-between break-all">
            quote:{''}
            <ContractAddress
              address={quote}
              abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
              copyButton={{ enableCopy: true, background: false }}
            />
          </div>
        </div>
      ) : undefined,
    aggregatorProxyAddress: (
      <div className="text-sm text-gray-500 ml-2 flex flex-col gap-2 justify-between break-all">
        address:{' '}
        <ContractAddress
          address={address}
          abbreviation={{ hasAbbreviation: true, bytesToShow: 4 }}
          copyButton={{ enableCopy: true, background: false }}
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
      <h1 className="text-2xl font-bold text-gray-900 mt-10 dark:text-white">
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
          key={`evm-access-info`}
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
          key={`questions`}
          title="Questions?"
          description="If you have any questions speak with our team on one of the following platforms:"
        >
          <DataFeedCardContentItem label="" value={<QuestionsCardContent />} />
        </DataFeedCardSection>
      </div>
    </div>
  );
}
