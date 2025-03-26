import React from 'react';

import { Tooltip } from '@blocksense/ui/Tooltip';
import { TooltipProps } from '../Tooltip/Tooltip';
import { Icon } from '@blocksense/ui/Icon';
import { cn } from '@blocksense/ui/utils';

type InfoTipProps = TooltipProps & {
  iconClassName?: string;
};

export function InfoTip({
  children,
  iconClassName,
  position,
  contentClassName,
}: InfoTipProps) {
  return (
    <Tooltip position={position} contentClassName={contentClassName}>
      <Tooltip.Content>{children}</Tooltip.Content>
      <Icon
        icon={{
          type: 'image',
          src: '/icons/info.svg',
        }}
        ariaLabel="Info icon"
        size="xs"
        className={cn('invert', iconClassName)}
      />
    </Tooltip>
  );
}
