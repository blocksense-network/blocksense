import React, { ReactNode } from 'react';
import { CardContent } from '@blocksense/docs-ui/Card';

type DataFeedCardContentProps = {
  children: ReactNode;
};

export const DataFeedCardContent = ({ children }: DataFeedCardContentProps) => {
  return (
    <CardContent className="data-feed-card-content px-4 py-4">
      {children}
    </CardContent>
  );
};
