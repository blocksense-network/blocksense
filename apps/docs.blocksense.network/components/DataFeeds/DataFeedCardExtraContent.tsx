import React from 'react';
import { CodeBlock } from '@/components/common/CodeBlock';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';

export const DataFeedCardExtraContent: React.FC<{
  type: 'Price Feed Properties' | 'Oracle Script Info' | 'Feed Registry';
  dataProviders?: string[];
  scriptArguments?: Record<string, any>;
  aggregatorProxyAddress?: string;
}> = ({ type, dataProviders, scriptArguments, aggregatorProxyAddress }) => {
  switch (type) {
    case 'Price Feed Properties':
      return (
        <div className="data-feed-card-content__item">
          <span className="data-feed-card-content__label text-sm text-gray-500">
            Data Providers
          </span>
          <div className="data-feed-card-content__value flex space-x-2">
            {dataProviders?.map(provider => (
              <DataTableBadge className="mt-1" key={provider}>
                {provider}
              </DataTableBadge>
            ))}
          </div>
        </div>
      );

    case 'Oracle Script Info':
      return (
        <div className="data-feed-card-content__item col-span-2">
          <span className="data-feed-card-content__label text-sm text-gray-500">
            Script Arguments
          </span>
          <CodeBlock
            code={JSON.stringify(scriptArguments, null, 2)}
            lang="json"
            theme="github-light"
            copy={{ haveButton: true, disabled: true }}
          />
        </div>
      );

    case 'Feed Registry':
      return (
        <div className="data-feed-card-content__item col-span-2">
          <span className="data-feed-card-content__label text-sm text-gray-500">
            Aggregator Proxy Address
          </span>
          <p className="data-feed-card-content__value text-sm font-noto-sans-bold text-gray-900 leading-snug">
            {aggregatorProxyAddress}
          </p>
        </div>
      );

    default:
      return null;
  }
};
