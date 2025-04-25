import React from 'react';

import { ImageWrapper } from '@blocksense/ui/ImageWrapper';

import { Button } from '@blocksense/ui/Button';

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
      className="format__button w-[100px] px-1 py-1 mr-3 shrink-0 flex items-center justify-center border-neutral-200 shadow-md dark:bg-neutral-900 dark:border-neutral-600 dark:text-white"
      variant="outline"
      onClick={formatHandler}
    >
      <ImageWrapper
        src={isFormatted ? '/icons/format-compact.svg' : '/icons/format.svg'}
        alt={isFormatted ? 'Compact' : 'Format'}
        className="relative w-6 h-6 mr-2 invert"
      />
      <span className="whitespace-nowrap dark:text-white">
        {isFormatted ? 'Compact' : 'Format'}
      </span>
    </Button>
  );
};
