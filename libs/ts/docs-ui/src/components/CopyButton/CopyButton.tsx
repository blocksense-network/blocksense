'use client';

import React, { useState } from 'react';
import type { MouseEvent } from 'react';

import { ImageWrapper } from '@blocksense/docs-ui/ImageWrapper';
import { Tooltip } from '@blocksense/docs-ui/Tooltip';

type CopyButtonProps = {
  textToCopy: string;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  copyButtonClasses?: string;
  disabled?: boolean;
  showTooltip?: boolean;
  background?: boolean;
};

export const CopyButton = ({
  background = true,
  copyButtonClasses = '',
  disabled = false,
  showTooltip = true,
  textToCopy,
  tooltipPosition = 'bottom',
}: CopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  let imageClassName = 'w-4 h-4 invert';

  const onCopy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  if (disabled) {
    copyButtonClasses += ' opacity-40 cursor-not-allowed pointer-events-none';
  }

  if (!background) {
    imageClassName += ' w-4.5 h-4.5';
  }

  const buttonContent = isCopied ? (
    <ImageWrapper
      src="/icons/check.svg"
      alt="Copied"
      className={imageClassName}
    />
  ) : (
    <ImageWrapper
      src="/icons/clipboard.svg"
      alt="Clipboard"
      className={imageClassName}
    />
  );

  return (
    <aside
      className={`signature__copy-button z-5 flex items-center justify-center ${background ? 'w-8 h-8 bg-slate-50 dark:bg-neutral-900 rounded-sm border border-neutral-200 dark:border-neutral-600' : ''} ${!isCopied && 'cursor-pointer'} ${copyButtonClasses}`}
      onClick={isCopied ? undefined : onCopy}
    >
      {showTooltip ? (
        <Tooltip position={tooltipPosition}>
          <Tooltip.Content>
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </Tooltip.Content>
          {buttonContent}
        </Tooltip>
      ) : (
        buttonContent
      )}
    </aside>
  );
};
