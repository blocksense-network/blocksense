import { capitalizeWords, showMsInSeconds, showPercentage } from '@/src/utils';
import { NewFeed } from '@blocksense/config-types';
import { DataFeedCardContentItem } from '../DataFeedCardContentItem';
import { DataFeedCardSection } from '../DataFeedCardSection';

type DataFeedCardProps = {
  feed: NewFeed;
};

export const ConsensusConfigCard = ({ feed }: DataFeedCardProps) => {
  const consensusInfo = {
    title: 'Consensus Configuration',
    description: '',
    items: [
      {
        label: 'Report Interval',
        value: showMsInSeconds(feed.schedule.interval_ms),
      },
      {
        label: 'Heartbeat',
        value: showMsInSeconds(feed.schedule.heartbeat_ms),
      },
      {
        label: 'Aggregator method',
        value: capitalizeWords(feed.quorum.aggregation),
      },
      {
        label: 'Threshold',
        value: showPercentage(feed.schedule.deviation_percentage),
      },
      {
        label: 'Required Quorum',
        value: showPercentage(feed.quorum.percentage),
      },
    ],
  };

  return (
    <DataFeedCardSection
      key={'dataFeedInfo'}
      title={consensusInfo.title}
      description={consensusInfo.description}
      info={
        'This is the default configuration. Values may vary depending on the network the data feed is deployed.'
      }
    >
      <div className="data-feed-card-content grid grid-cols-2 gap-4">
        {consensusInfo.items.map((item, idx) => (
          <DataFeedCardContentItem
            key={idx}
            label={item.label}
            value={item.value}
          />
        ))}
      </div>
    </DataFeedCardSection>
  );
};
