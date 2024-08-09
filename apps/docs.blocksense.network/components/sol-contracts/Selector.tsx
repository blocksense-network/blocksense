import React from 'react';

import { CopyButton } from '@/components/common/CopyButton';

type SelectorProps = {
  selector?: string;
};

export const Selector = ({ selector = '' }: SelectorProps) => {
  const resultSelector = `0x${selector}`;

  return (
    selector && (
      <aside className="selector-container flex flex-1 items-center justify-end p-2">
        <p className="selector-container__text hidden 2xl:block bg-slate-100 px-2">
          {resultSelector}
        </p>
        <CopyButton textToCopy={resultSelector} tooltipPosition="top" />
      </aside>
    )
  );
};
