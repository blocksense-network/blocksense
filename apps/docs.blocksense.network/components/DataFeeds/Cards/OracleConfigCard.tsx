import { NewFeed } from '@blocksense/config-types';

import { Card, CardHeader, CardTitle } from '@blocksense/docs-ui/Card';

import { CodeBlock } from '@/components/common/CodeBlock';
import { ScrollArea } from '@blocksense/docs-ui/ScrollArea';
import { shikiDefaultThemes } from '@/config';

type DataFeedCardProps = {
  feed: NewFeed;
};

export const OracleConfigCard = ({ feed }: DataFeedCardProps) => {
  return (
    <Card className="data-feed-card-section">
      <CardHeader className="data-feed-card__header flex flex-col space-y-1.5 px-4 mt-3 mb-3">
        <div className="flex items-center justify-center md:justify-around">
          <CardTitle className="data-feed-card__title text-xl font-semibold text-gray-900">
            Oracle Configuration
          </CardTitle>
        </div>
      </CardHeader>

      <div className="flex flex-col gap-6 px-4 md:flex-row md:justify-around">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="flex flex-col pb-4">
            <span className="text-sm text-gray-500">Component:</span>
            <div className="text-sm font-bold text-gray-900 leading-snug dark:text-white">
              {feed.oracle_id}
            </div>
          </div>
          <div className="flex flex-col pb-4">
            <span className="text-sm text-gray-500">Report Data Type:</span>
            <div className="text-sm font-bold text-gray-900 leading-snug dark:text-white">
              f64
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/2">
          <span className="text-sm text-gray-500">Arguments:</span>
          <ScrollArea className="border border-neutral-200 dark:border-neutral-600 rounded-lg max-h-[30vh] overflow-auto mt-2">
            <CodeBlock
              code={JSON.stringify(
                feed.additional_feed_info.arguments,
                null,
                2,
              )}
              lang="json"
              themes={shikiDefaultThemes.jsonThemes}
              className="oracle-args--pre overflow-x-scroll"
            />
          </ScrollArea>
        </div>
      </div>
    </Card>
  );
};
