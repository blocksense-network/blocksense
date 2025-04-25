import React, { ReactNode } from 'react';

type DataFeedCardContentItemProps = {
  label: string | ReactNode;
  value: ReactNode;
};

export const DataFeedCardContentItem = ({
  label,
  value,
}: DataFeedCardContentItemProps) => (
  <div className="data-feed-card-content__item mb-2">
    <span className="data-feed-card-content__label text-sm text-gray-500">
      {label}
    </span>
    <div className="data-feed-card-content__value text-sm font-bold text-gray-900 leading-snug dark:text-white">
      {value}
    </div>
  </div>
);
