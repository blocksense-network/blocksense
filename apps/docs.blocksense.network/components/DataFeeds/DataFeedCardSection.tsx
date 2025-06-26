import React, { ReactNode } from 'react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@blocksense/docs-ui/Card';
import { InfoTip } from '@blocksense/docs-ui/InfoTip';
import { DataFeedCardContent } from '@/components/DataFeeds/DataFeedCardContent';

type DataFeedCardSectionProps = {
  title: string;
  description: string;
  info?: string;
  children: ReactNode;
};

export const DataFeedCardSection = ({
  title,
  description,
  info,
  children,
}: DataFeedCardSectionProps) => {
  return (
    <Card className="data-feed-card-section px-2 py-2">
      <CardHeader className="data-feed-card__header flex flex-col space-y-1.5 px-4 mt-3 mb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="data-feed-card__title text-xl font-semibold">
            {title}
          </CardTitle>
          {info && (
            <InfoTip
              position="bottom"
              contentClassName="font-light text-sm text-gray-500"
            >
              {info}
            </InfoTip>
          )}
        </div>
        <CardDescription className="data-feed-card__description text-sm text-gray-500">
          {description}
        </CardDescription>
      </CardHeader>
      <DataFeedCardContent>{children}</DataFeedCardContent>
    </Card>
  );
};
