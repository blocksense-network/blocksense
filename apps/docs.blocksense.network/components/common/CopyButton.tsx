import React from 'react';
import { Tooltip } from '@/components/common/Tooltip';

type CopyButtonProps = {
  textToCopy: string;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
};

export const CopyButton = ({
  textToCopy,
  tooltipPosition = 'bottom',
}: CopyButtonProps) => {
  const [isCopied, setIsCopied] = React.useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <aside className="signature__copy-button">
      <Tooltip position={tooltipPosition}>
        <Tooltip.Content>
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </Tooltip.Content>
        {isCopied ? (
          <img src="/icons/check.svg" alt="Copied" className="w-5 h-5" />
        ) : (
          <img
            src="/icons/clipboard.svg"
            alt="Clipboard"
            onClick={onCopy}
            className="w-5 h-5 cursor-pointer"
          />
        )}
      </Tooltip>
    </aside>
  );
};
