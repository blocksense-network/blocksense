import React from 'react';

import { Tooltip } from '@/components/common/Tooltip';
import { ImageWrapper } from '@/components/common/ImageWrapper';

type CopyButtonProps = {
  textToCopy: string;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  copyButtonClasses?: string;
};

export const CopyButton = ({
  textToCopy,
  tooltipPosition = 'bottom',
  copyButtonClasses = '',
}: CopyButtonProps) => {
  const [isCopied, setIsCopied] = React.useState(false);

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <aside className={`signature__copy-button ${copyButtonClasses}`}>
      <Tooltip position={tooltipPosition}>
        <Tooltip.Content>
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </Tooltip.Content>
        {isCopied ? (
          <ImageWrapper
            src="/icons/check.svg"
            alt="Copied"
            className="relative w-5 h-5"
          />
        ) : (
          <ImageWrapper
            src="/icons/clipboard.svg"
            alt="Clipboard"
            className="relative w-5 h-5 cursor-pointer"
            onClick={onCopy}
          />
        )}
      </Tooltip>
    </aside>
  );
};
