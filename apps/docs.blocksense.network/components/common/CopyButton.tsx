import React from 'react';

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
  const [isCopied, setIsCopied] = React.useState(false);

  const onCopy = (e: React.MouseEvent) => {
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
    <aside className={`signature__copy-button ${copyButtonClasses}`}>
      <Tooltip position={tooltipPosition}>
        <Tooltip.Content>
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </Tooltip.Content>
        {isCopied ? (
          <ImageWrapper
            src="/icons/check.svg"
            alt="Copied"
            className="relative w-5 h-5 invert"
          />
        ) : (
          <ImageWrapper
            src="/icons/clipboard.svg"
            alt="Clipboard"
            className="relative w-5 h-5 cursor-pointer invert"
            onClick={onCopy}
          />
        )}
      </Tooltip>
    </aside>
  );
};
