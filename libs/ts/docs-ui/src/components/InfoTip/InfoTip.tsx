import React from 'react';

import { Icon } from '@blocksense/docs-ui/Icon';
import { Tooltip } from '@blocksense/docs-ui/Tooltip';
import { cn } from '@blocksense/docs-ui/utils';

import type { TooltipProps } from '../Tooltip/Tooltip';

type InfoTipProps = TooltipProps & {
  iconClassName?: string;
};

export function InfoTip({
  children,
  contentClassName,
  iconClassName,
  position,
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
