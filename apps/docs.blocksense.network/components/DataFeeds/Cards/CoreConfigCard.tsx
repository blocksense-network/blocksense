import { capitalizeWords } from '@/src/utils';
import { NewFeed } from '@blocksense/config-types';
import { DataFeedCardContentItem } from '../DataFeedCardContentItem';
import { DataFeedCardSection } from '../DataFeedCardSection';

type DataFeedCardProps = {
  feed: NewFeed;
};

export const CoreConfigCard = ({ feed }: DataFeedCardProps) => {
  const coreInfo = {
    title: 'Core Configuration',
    description: '',
    items: [
      { label: 'Feed Name', value: feed.full_name },
      { label: 'Feed Type', value: capitalizeWords(feed.type) },
      { label: 'Feed ID', value: feed.id },
      { label: 'Stride', value: feed.stride },
      //TODO: Add `Data Format`
    ],
  };

  return (
    <DataFeedCardSection
      key={'dataFeedInfo'}
      title={coreInfo.title}
      description={coreInfo.description}
    >
      <div>
        <div className="data-feed-card-content grid grid-cols-2 gap-4">
          {coreInfo.items.map((item, idx) => (
            <DataFeedCardContentItem
              key={idx}
              label={item.label}
              value={item.value}
            />
          ))}
        </div>
        <div>
          <span className="data-feed-card-content__label text-sm text-gray-500">
            Description:
          </span>
          <div className="data-feed-card-content__value text-sm font-bold text-gray-900 leading-snug dark:text-white">
            {feed.description}
          </div>
        </div>
      </div>
    </DataFeedCardSection>
  );
};
