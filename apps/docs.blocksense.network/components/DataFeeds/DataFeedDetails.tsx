import React from 'react';
import { decodeFeed } from '@blocksense/config-types/data-feeds-config';
import { DataFeedCardSection } from '@/components/DataFeeds/DataFeedCardSection';
import { DataFeedCardContentItem } from '@/components/DataFeeds/DataFeedCardContentItem';
import { DataFeedCardExtraContent } from '@/components/DataFeeds/DataFeedCardExtraContent';

export const DataFeedDetails: React.FC<{
  feedJsonString: string;
}> = ({ feedJsonString }) => {
  const feed = decodeFeed(JSON.parse(feedJsonString));

  const {
    id,
    description,
    decimals,
    pair,
    report_interval_ms,
    first_report_start_time,
    quorum_percentage,
    script,
    type,
    resources,
  } = feed;

  const oracleScriptId = 1;
  const scriptVersion = '0.0.0';
  const feedRegistry = {
    baseAddress: '0xBaseAddress',
    quoteAddress: '0xQuoteAddress',
    aggregatorProxyAddress: '0xAggregatorProxyAddress',
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
        // { label: 'Genesis Time', value: 'N/A' },
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
    {
      title: 'Oracle Script Info',
      description:
        'Detail featured elements of an oracle script for precise and efficient execution',
      items: [{ label: 'Script Name', value: 'No available script' }],
      extra: {
        type: 'Oracle Script Info' as const,
        scriptArguments: {},
      },
    },
    {
      title: 'Feed Registry',
      description:
        'Highlight detail components of a feed registry for effective data management',
      items: [
        { label: 'Base Address', value: feedRegistry.baseAddress },
        { label: 'Quote Address', value: feedRegistry.quoteAddress },
      ],
      extra: {
        type: 'Feed Registry' as const,
        aggregatorProxyAddress: feedRegistry.aggregatorProxyAddress,
      },
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
              {section.extra && (
                <DataFeedCardExtraContent
                  type={section.extra.type}
                  scriptArguments={section.extra.scriptArguments}
                  aggregatorProxyAddress={section.extra.aggregatorProxyAddress}
                />
              )}
            </div>
          </DataFeedCardSection>
        ))}
      </div>
    </div>
  );
};
