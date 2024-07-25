import React from 'react';

import { CopyButton } from '@/components/common/CopyButton';

type SelectorProps = {
  selector?: string;
};

export const Selector = ({ selector = '' }: SelectorProps) => {
  const resultSelector = `0x${selector}`;

  return (
    selector && (
      <div className="flex gap-2 items-center">
        <p className="bg-gray-200 p-1 rounded w-fit">{resultSelector}</p>
        <CopyButton textToCopy={resultSelector} />
      </div>
    )
  );
};
