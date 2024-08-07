import React from 'react';
import { Tooltip } from '@/components/common/Tooltip';

type CopyButtonProps = {
  textToCopy: string;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  isCodeSnippet?: boolean;
};

export const CopyButton = ({
  textToCopy,
  tooltipPosition = 'bottom',
  isCodeSnippet = false,
}: CopyButtonProps) => {
  const [isCopied, setIsCopied] = React.useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const classNames = 'signature__copy-button'.concat(
    isCodeSnippet ? ' absolute top-0 right-0 m-2 nx-z-10' : '',
  );

  return (
    <aside className={classNames}>
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
