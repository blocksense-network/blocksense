'use client';

import { MouseEvent, useState } from 'react';

import { Tooltip } from '@/components/common/Tooltip';
import { ImageWrapper } from '@/components/common/ImageWrapper';

type CopyButtonProps = {
  textToCopy: string;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  copyButtonClasses?: string;
  disabled?: boolean;
};

export const CopyButton = ({
  textToCopy,
  tooltipPosition = 'bottom',
  copyButtonClasses = '',
  disabled = false,
}: CopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const onCopy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  disabled
    ? (copyButtonClasses +=
        ' opacity-40 cursor-not-allowed pointer-events-none')
    : null;

  return (
    <aside
      className={`signature__copy-button z-5 border ms-auto rounded-sm border-neutral-200 bg-slate-50 dark:bg-neutral-900 dark:border-neutral-600 flex items-center justify-center w-8 h-8 ${copyButtonClasses}`}
    >
      <Tooltip position={tooltipPosition}>
        <Tooltip.Content>
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </Tooltip.Content>
        {isCopied ? (
          <ImageWrapper
            src="/icons/check.svg"
            alt="Copied"
            className="w-4 h-4 invert"
          />
        ) : (
          <ImageWrapper
            src="/icons/clipboard.svg"
            alt="Clipboard"
            className="w-4 h-4 cursor-pointer invert"
            onClick={onCopy}
          />
        )}
      </Tooltip>
    </aside>
  );
};
