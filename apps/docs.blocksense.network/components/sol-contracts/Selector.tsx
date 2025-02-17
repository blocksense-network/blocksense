import React from 'react';

import { CopyButton } from '@blocksense/ui/CopyButton';

type SelectorProps = {
  selector?: string;
};

export const Selector = ({ selector = '' }: SelectorProps) => {
  const resultSelector = `0x${selector}`;

  return (
    selector && (
      <aside className="selector-container flex flex-1 items-center justify-end">
        <p className="selector-container__text mr-2">{resultSelector}</p>
        <CopyButton textToCopy={resultSelector} tooltipPosition="top" />
      </aside>
    )
  );
};
