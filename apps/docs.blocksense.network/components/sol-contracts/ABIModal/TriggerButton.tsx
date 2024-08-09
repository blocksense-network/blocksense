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
      <Button variant="outline" className="my-2">
        ABI
      </Button>
    </Tooltip>
  );
};
