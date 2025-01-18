import React from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/common/Tooltip';

type TriggerButtonProps = {
  tooltipContent?: string;
};

export const TriggerButton = ({ tooltipContent }: TriggerButtonProps) => {
  return (
    <Tooltip position="right">
      <Tooltip.Content>{tooltipContent}</Tooltip.Content>
      <Button
        variant="secondary"
        className="mt-2 mb-2 font-bold w-full min-w-16 border-solid border border-slate-200 bg-slate-50 rounded-md dark:bg-neutral-900 dark:border-neutral-600 dark:text-white dark:hover:bg-black"
      >
        ABI
      </Button>
    </Tooltip>
  );
};
