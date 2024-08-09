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
    <Button variant="outline" onClick={formatHandler} className={'w-full'}>
      {isFormatted ? 'Compact' : 'Format'}
    </Button>
  );
};
