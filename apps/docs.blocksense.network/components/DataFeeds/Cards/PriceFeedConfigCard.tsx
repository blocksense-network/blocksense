import { NewFeed } from '@blocksense/config-types';
import { DataFeedCardContentItem } from '../DataFeedCardContentItem';
import { DataFeedCardSection } from '../DataFeedCardSection';
import { getDataSources } from '@/src/data-feeds/utils';

type DataFeedCardProps = {
  feed: NewFeed;
};

export const PriceFeedConfigCard = ({ feed }: DataFeedCardProps) => {
  const priceFeedInfo = {
    title: 'Price Feed Configuration',
    description: '',
    items: [
      { label: 'Base', value: feed.additional_feed_info.pair.base },
      { label: 'Quote', value: feed.additional_feed_info.pair.quote },
      { label: 'Decimals', value: feed.additional_feed_info.decimals },
      { label: 'Category', value: feed.additional_feed_info.category },
    ],
  };

  return (
    <DataFeedCardSection
      key={'priceFeedInfo'}
      title={priceFeedInfo.title}
      description={priceFeedInfo.description}
    >
      <div>
        <div className="data-feed-card-content grid grid-cols-2 gap-4">
          {priceFeedInfo.items.map((item, idx) => (
            <DataFeedCardContentItem
              key={idx}
              label={item.label}
              value={item.value}
            />
          ))}
        </div>
        <div>
          <span className="data-feed-card-content__label text-sm text-gray-500">
            Data Sources:
          </span>
          <div className="data-feed-card-content__value text-sm font-bold text-gray-900 leading-snug dark:text-white">
            {getDataSources(feed).join(', ')}
          </div>
        </div>
      </div>
    </DataFeedCardSection>
  );
};
