import React, { ReactNode } from 'react';

type DataFeedCardContentItemProps = {
  label: string;
  value: ReactNode;
};

export const DataFeedCardContentItem = ({
  label,
  value,
}: DataFeedCardContentItemProps) => (
  <div className="data-feed-card-content__item">
    <span className="data-feed-card-content__label text-sm text-gray-500">
      {label}
    </span>
    <p className="data-feed-card-content__value text-sm font-noto-sans-bold text-gray-900 leading-snug">
      {value}
    </p>
  </div>
);
