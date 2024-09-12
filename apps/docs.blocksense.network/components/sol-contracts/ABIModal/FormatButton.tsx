import React from 'react';

import { Button } from '@/components/ui/button';

type FormatButtonProps = {
  formatHandler: () => void;
  isFormatted: boolean;
};

export const FormatButton = ({
  formatHandler,
  isFormatted,
}: FormatButtonProps) => {
  return (
    <Button
      className="format__button w-[100px] px-1 py-1 mr-3 flex-shrink-0 flex items-center justify-center"
      variant="outline"
      onClick={formatHandler}
    >
      <img
        src={isFormatted ? '/icons/format-compact.svg' : '/icons/format.svg'}
        alt={isFormatted ? 'Compact' : 'Format'}
        className="w-6 h-6 mr-2"
      />
      <span className="whitespace-nowrap">
        {isFormatted ? 'Compact' : 'Format'}
      </span>
    </Button>
  );
};
