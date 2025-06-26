import React, { ReactNode } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@blocksense/docs-ui/Card';
import { DataFeedCardContent } from '@/components/DataFeeds/DataFeedCardContent';

type DataFeedCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export const DataFeedCard = ({
  title,
  description,
  children,
}: DataFeedCardProps) => {
  return (
    <Card className="data-feed-card px-2 py-2">
      <CardHeader className="data-feed-card__header flex flex-col space-y-1.5 px-4 mt-3 mb-3">
        <CardTitle className="data-feed-card__title text-xl font-semibold text-gray-900">
          {title}
        </CardTitle>
        <CardDescription className="data-feed-card__description text-sm text-gray-500">
          {description}
        </CardDescription>
      </CardHeader>
      <DataFeedCardContent>{children}</DataFeedCardContent>
    </Card>
  );
};
